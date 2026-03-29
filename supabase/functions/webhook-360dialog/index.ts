import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Webhook endpoint for 360dialog WhatsApp Business API.
 * Processes interactive button replies for visit confirmations ("Sim" / "Nao").
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Always return 200 quickly to avoid 360dialog retries
  const ok = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    console.log("webhook-360dialog payload:", JSON.stringify(body).slice(0, 2000));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 360dialog Cloud API sends statuses + messages in the same structure
    // We only care about incoming messages with button replies
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;

    // Also handle flat payload from 360dialog (non-Cloud API format)
    const messages = changes?.messages || body?.messages;
    const contacts = changes?.contacts || body?.contacts;

    if (!messages || messages.length === 0) {
      // Could be a status update (sent, delivered, read) — ignore
      return ok();
    }

    const msg = messages[0];
    const from = msg.from; // e.g. "5551999999999"

    if (!from) {
      console.warn("No 'from' field in message");
      return ok();
    }

    // Extract button text from different payload formats
    let buttonText: string | null = null;

    // Format 1: Quick reply button
    if (msg.type === "button" && msg.button?.text) {
      buttonText = msg.button.text;
    }
    // Format 2: Interactive button reply
    if (msg.type === "interactive" && msg.interactive?.button_reply) {
      buttonText = msg.interactive.button_reply.title || msg.interactive.button_reply.id;
    }
    // Format 3: Simple text that matches "Sim" or "Nao"
    if (!buttonText && msg.type === "text" && msg.text?.body) {
      const txt = msg.text.body.trim().toLowerCase();
      if (txt === "sim" || txt === "nao" || txt === "não") {
        buttonText = msg.text.body.trim();
      }
    }

    if (!buttonText) {
      console.log("Message is not a visit confirmation button reply, ignoring");
      return ok();
    }

    const normalizedButton = buttonText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isConfirmed = normalizedButton === "sim";
    const isDenied = normalizedButton === "nao" || normalizedButton === "não";

    if (!isConfirmed && !isDenied) {
      console.log(`Button text "${buttonText}" is not a visit confirmation`);
      return ok();
    }

    // Normalize phone: strip non-digits, ensure starts with 55
    let phone = from.replace(/\D/g, "");
    if (!phone.startsWith("55") && phone.length <= 11) {
      phone = "55" + phone;
    }

    // Contact name from 360dialog payload
    const contactName = contacts?.[0]?.profile?.name || null;

    // --- Find the lead by phone ---
    const { data: lead } = await supabase
      .from("pipeline_leads")
      .select("id, nome, corretor_id, telefone")
      .or(`telefone.eq.${phone},telefone.eq.+${phone},telefone.ilike.%${phone.slice(-10)}%`)
      .limit(1)
      .maybeSingle();

    if (!lead) {
      console.warn(`Lead not found for phone ${phone}`);
      return ok();
    }

    const leadName = lead.nome || contactName || phone;
    const corretorId = lead.corretor_id;

    // --- Find the closest upcoming visit for this lead ---
    const today = new Date().toISOString().split("T")[0];

    const { data: visita } = await supabase
      .from("visitas")
      .select("id, data_visita, hora_visita, status, corretor_id, empreendimento, pipeline_lead_id")
      .or(`pipeline_lead_id.eq.${lead.id},telefone.eq.${phone}`)
      .gte("data_visita", today)
      .in("status", ["marcada", "confirmada", "reagendada"])
      .order("data_visita", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!visita) {
      console.warn(`No upcoming visit found for lead ${lead.id} (${leadName})`);
      // Still log the interaction in lead history
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: `Resposta WhatsApp: "${buttonText}" (sem visita vinculada)`,
        descricao: `Lead respondeu "${buttonText}" ao template de confirmação, mas nenhuma visita futura foi encontrada.`,
        created_by: corretorId || "system",
      });
      return ok();
    }

    const visitCorretorId = visita.corretor_id || corretorId;

    if (isConfirmed) {
      // --- CONFIRMED ---
      // 1. Update visit status
      await supabase
        .from("visitas")
        .update({
          status: "confirmada",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", visita.id);

      // 2. Log in lead activity history
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: "Lead confirmou a visita via WhatsApp ✅",
        descricao: `${leadName} confirmou presença na visita de ${visita.data_visita}${visita.hora_visita ? " às " + visita.hora_visita : ""} (${visita.empreendimento || "imóvel"}).`,
        created_by: visitCorretorId || "system",
      });

      // 3. Notify the responsible broker
      if (visitCorretorId) {
        await supabase.from("notifications").insert({
          user_id: visitCorretorId,
          tipo: "visitas",
          categoria: "visita_confirmada",
          titulo: `✅ ${leadName} confirmou a visita!`,
          mensagem: `O lead ${leadName} confirmou presença na visita de ${visita.data_visita}${visita.hora_visita ? " às " + visita.hora_visita : ""}.`,
          dados: {
            lead_id: lead.id,
            visita_id: visita.id,
            pipeline_lead_id: visita.pipeline_lead_id || lead.id,
            source: "whatsapp_button",
          },
        });
      }

      console.log(`Visit ${visita.id} CONFIRMED by lead ${lead.id} (${leadName})`);
    } else {
      // --- DENIED / RESCHEDULE ---
      // 1. Update visit status
      await supabase
        .from("visitas")
        .update({
          status: "reagendada",
          cancel_reason: "Lead solicitou reagendamento via WhatsApp",
        })
        .eq("id", visita.id);

      // 2. Log in lead activity history
      await supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: "Lead solicitou reagendamento da visita via WhatsApp ❌",
        descricao: `${leadName} informou que não poderá comparecer à visita de ${visita.data_visita}${visita.hora_visita ? " às " + visita.hora_visita : ""}.`,
        created_by: visitCorretorId || "system",
      });

      // 3. Notify the responsible broker
      if (visitCorretorId) {
        await supabase.from("notifications").insert({
          user_id: visitCorretorId,
          tipo: "visitas",
          categoria: "visita_reagendar",
          titulo: `❌ ${leadName} não poderá comparecer à visita`,
          mensagem: `O lead ${leadName} solicitou reagendamento da visita de ${visita.data_visita}. Entre em contato para reagendar.`,
          dados: {
            lead_id: lead.id,
            visita_id: visita.id,
            pipeline_lead_id: visita.pipeline_lead_id || lead.id,
            source: "whatsapp_button",
          },
        });
      }

      // 4. Create automatic task for the broker to reschedule
      if (visitCorretorId) {
        await supabase.from("pipeline_tarefas").insert({
          pipeline_lead_id: lead.id,
          titulo: `Reagendar visita com ${leadName}`,
          descricao: `${leadName} informou via WhatsApp que não poderá comparecer à visita de ${visita.data_visita}. Reagende o mais rápido possível.`,
          tipo: "visita",
          prioridade: "alta",
          status: "pendente",
          vence_em: today,
          responsavel_id: visitCorretorId,
          created_by: visitCorretorId,
        });
      }

      console.log(`Visit ${visita.id} DENIED by lead ${lead.id} (${leadName}) — task created`);
    }

    return ok();
  } catch (e) {
    console.error("webhook-360dialog error:", e);
    // Still return 200 to avoid retries
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
