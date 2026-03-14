import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "visita-whatsapp-confirm";
const DIALOG_API_URL = "https://waba-v2.360dialog.io/messages";

function makeLogger(traceId: string) {
  const emit = (level: string, msg: string, ctx?: Record<string, unknown>, err?: unknown) => {
    const payload = { fn: FN, level, msg, traceId, ctx, err: err instanceof Error ? { name: err.name, message: err.message } : err ? { raw: String(err) } : undefined, ts: new Date().toISOString() };
    level === "error" ? console.error(JSON.stringify(payload)) : level === "warn" ? console.warn(JSON.stringify(payload)) : console.info(JSON.stringify(payload));
  };
  return {
    info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("warn", msg, ctx, err),
    error: (msg: string, ctx?: Record<string, unknown>, err?: unknown) => emit("error", msg, ctx, err),
  };
}

function formatPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = clean.substring(1);
  if (!clean.startsWith("55")) clean = "55" + clean;
  return clean;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "horário a confirmar";
  return timeStr.substring(0, 5);
}

async function sendWhatsApp(apiKey: string, phone: string, message: string) {
  const formattedPhone = formatPhone(phone);

  const resp = await fetch(DIALOG_API_URL, {
    method: "POST",
    headers: {
      "D360-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: { body: message },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `360dialog error: ${resp.status}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = makeLogger(traceId);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: FN, level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    // Get 360dialog API key
    const { data: setting } = await supabase
      .from("integration_settings")
      .select("value")
      .eq("key", "360dialog_api_key")
      .single();

    if (!setting?.value) {
      L.warn("360dialog API key not configured");
      return new Response(
        JSON.stringify({ error: "API key do 360dialog não configurada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = setting.value;
    const { action, visita_id, visita_data } = await req.json();

    // ─── ACTION: confirm (Trigger 1 — immediate on creation) ───
    if (action === "confirm") {
      const visita = visita_data;
      if (!visita?.telefone) {
        return new Response(
          JSON.stringify({ success: false, reason: "no_phone" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get corretor name
      let corretorNome = "seu corretor";
      if (visita.corretor_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome")
          .eq("user_id", visita.corretor_id)
          .maybeSingle();
        if (profile?.nome) corretorNome = profile.nome;
      }

      // Build confirmation link if token available
      const confirmLink = visita.confirmation_token
        ? `\n\nPara confirmar, reagendar ou cancelar sua visita, acesse:\nhttps://uhomesales.com/visita/${visita.confirmation_token}`
        : "";

      const message = `Olá ${visita.nome_cliente || ""}! 👋 Sua visita ao ${visita.empreendimento || "empreendimento"} está confirmada para ${formatDate(visita.data_visita)} às ${formatTime(visita.hora_visita)}. Seu corretor ${corretorNome} estará te esperando.${confirmLink}\nQualquer dúvida é só responder esta mensagem. Até lá! 🏠`;

      try {
        const result = await sendWhatsApp(apiKey, visita.telefone, message);
        L.info("Confirmation sent", { visita_id, phone: visita.telefone?.slice(-4) });
        return new Response(
          JSON.stringify({ success: true, message_id: result?.messages?.[0]?.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (sendErr) {
        L.error("Confirmation WhatsApp failed", { visita_id }, sendErr);
        logOps("error", "integration", "WhatsApp confirmation send failed", { visita_id }, sendErr instanceof Error ? sendErr.message : String(sendErr));
        throw sendErr;
      }
    }

    // ─── ACTION: reminder_cron (Trigger 2 — 24h before) ───
    if (action === "reminder_cron") {
      // Calculate tomorrow's date in BRT
      const now = new Date();
      const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const tomorrow = new Date(brt);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // Fetch visits scheduled for tomorrow with status marcada or confirmada
      const { data: visitas, error } = await supabase
        .from("visitas")
        .select("id, nome_cliente, telefone, empreendimento, data_visita, hora_visita, corretor_id, status")
        .eq("data_visita", tomorrowStr)
        .in("status", ["marcada", "confirmada"]);

      if (error) {
        L.error("Failed to fetch visitas", {}, error);
        logOps("error", "system", "Failed to fetch visitas for reminder", {}, error.message);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar visitas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let sent = 0;
      let skipped = 0;
      let errors = 0;

      for (const v of visitas || []) {
        if (!v.telefone) {
          skipped++;
          continue;
        }

        // Get corretor name
        let corretorNome = "seu corretor";
        if (v.corretor_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome")
            .eq("user_id", v.corretor_id)
            .maybeSingle();
          if (profile?.nome) corretorNome = profile.nome;
        }

        const message = `Olá ${v.nome_cliente || ""}! 🔔 Lembrete: amanhã às ${formatTime(v.hora_visita)} você tem visita ao ${v.empreendimento || "empreendimento"} com ${corretorNome}. Confirma sua presença? Responda SIM para confirmar ou NOS chame para reagendar.`;

        try {
          await sendWhatsApp(apiKey, v.telefone, message);
          sent++;
        } catch (e) {
          L.warn("Reminder send failed", { visita_id: v.id }, e);
          errors++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 300));
      }

      const result = { total: (visitas || []).length, sent, skipped, errors, date: tomorrowStr };
      L.info("Reminder cron complete", result as unknown as Record<string, unknown>);
      if (sent > 0 || errors > 0) {
        logOps("info", "business", `Visit reminders: ${sent} sent, ${errors} errors, ${skipped} skipped`, result as unknown as Record<string, unknown>);
      }
      if (errors > 0) {
        logOps("warn", "integration", `${errors} WhatsApp reminder(s) failed`, { errors, total: (visitas || []).length });
      }

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    L.warn("Invalid action received", { action });
    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    L.error("Unhandled exception", {}, e);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: FN, level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: e instanceof Error ? e.message : String(e) }).then(() => {});
    } catch {}
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
