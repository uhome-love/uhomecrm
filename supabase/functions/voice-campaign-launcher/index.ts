// =============================================================================
// Edge Function: voice-campaign-launcher
// Lança campanhas de voz IA em lote (Twilio + ElevenLabs)
// CEO inicia campanha → processa leads em batches de 50
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const MAX_BATCH = 50;

// Horário permitido: 9h-20h BRT (UTC-3)
function isWithinCallWindow(): boolean {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const day = now.getUTCDay();
  // Seg-Sex: 9-20h, Sáb: 9-17h (se explicitamente autorizado)
  if (day === 0) return false; // Domingo
  if (brtHour < 9 || brtHour >= 20) return false;
  return true;
}

interface LaunchRequest {
  campaign_id?: string; // Resume existing campaign
  nome?: string;
  template: string;
  lead_ids: string[];
  criado_por: string;
  delay_between_calls_ms?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: LaunchRequest = await req.json();

    if (!isWithinCallWindow()) {
      return new Response(JSON.stringify({
        error: "Fora da janela de horário permitido (9h-20h BRT, seg-sex)",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or resume campaign
    let campaignId = body.campaign_id;

    if (!campaignId) {
      const { data: campaign, error: campErr } = await supabase
        .from("voice_campaigns")
        .insert({
          nome: body.nome || `Campanha ${body.template} — ${new Date().toLocaleDateString("pt-BR")}`,
          template: body.template,
          lead_ids: body.lead_ids,
          status: "em_andamento",
          total: body.lead_ids.length,
          criado_por: body.criado_por,
        })
        .select("id")
        .single();

      if (campErr) throw campErr;
      campaignId = campaign!.id;
    }

    // Fetch lead data
    const leadIds = body.lead_ids.slice(0, MAX_BATCH);
    const { data: leads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, empreendimento, bairro, corretor_id")
      .in("id", leadIds);

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum lead encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;
    const delayMs = body.delay_between_calls_ms || 30000; // 30s default

    for (const lead of leads) {
      if (!lead.telefone) {
        errors++;
        continue;
      }

      let phone = lead.telefone.replace(/\D/g, "");
      if (!phone.startsWith("55")) phone = "55" + phone;

      // Log the call attempt
      const { data: callLog } = await supabase
        .from("voice_call_logs")
        .insert({
          campaign_id: campaignId,
          pipeline_lead_id: lead.id,
          telefone: phone,
          status: "iniciada",
        })
        .select("id")
        .single();

      // Trigger Twilio AI call via existing edge function
      try {
        const callResponse = await fetch(`${SUPABASE_URL}/functions/v1/twilio-ai-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            telefone: phone,
            lead_id: lead.id,
            nome: lead.nome || "Cliente",
            empreendimento: lead.empreendimento || "",
            contexto: `Campanha de voz: ${body.template}. Lead: ${lead.nome}. Empreendimento: ${lead.empreendimento || "N/A"}.`,
            campaign_id: campaignId,
            voice_log_id: callLog?.id,
          }),
        });

        if (callResponse.ok) {
          processed++;
        } else {
          const errText = await callResponse.text();
          console.error(`Call failed for lead ${lead.id}:`, errText);
          if (callLog?.id) {
            await supabase
              .from("voice_call_logs")
              .update({ status: "erro", resumo_ia: errText.slice(0, 500) })
              .eq("id", callLog.id);
          }
          errors++;
        }
      } catch (e: any) {
        console.error(`Call exception for lead ${lead.id}:`, e);
        if (callLog?.id) {
          await supabase
            .from("voice_call_logs")
            .update({ status: "erro", resumo_ia: e.message?.slice(0, 500) })
            .eq("id", callLog.id);
        }
        errors++;
      }

      // Delay between calls
      if (delayMs > 0 && processed + errors < leads.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Update campaign stats
    await supabase
      .from("voice_campaigns")
      .update({
        status: processed + errors >= body.lead_ids.length ? "concluida" : "em_andamento",
        completed_at: processed + errors >= body.lead_ids.length ? new Date().toISOString() : null,
      })
      .eq("id", campaignId);

    console.log(`Voice campaign ${campaignId}: ${processed} calls made, ${errors} errors`);

    return new Response(
      JSON.stringify({ campaign_id: campaignId, processed, errors, total: leads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Voice campaign launcher error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
