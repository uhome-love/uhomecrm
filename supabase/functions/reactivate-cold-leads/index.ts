// =============================================================================
// Edge Function: reactivate-cold-leads
// Roda via cron semanal (domingo 22:00 BRT)
// Busca leads descartados e parados, agenda sequências multicanal
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Intervalo mínimo entre nutrições do mesmo lead (dias)
const MIN_NURTURING_INTERVAL_DAYS = 15;
// Limite diário de WhatsApp
const MAX_WHATSAPP_PER_DAY = 200;

interface SequenceStep {
  step_key: string;
  delay_days: number;
  canal: "whatsapp" | "email";
  template_name?: string;  // para WhatsApp
  template_key?: string;   // para Email
  mensagem: string;
}

// Sequências por tipo
const SEQUENCES: Record<string, SequenceStep[]> = {
  sem_contato: [
    { step_key: "sc_d0_wa", delay_days: 0, canal: "whatsapp", template_name: "reativacao_vitrine", mensagem: "WhatsApp: Vitrine personalizada" },
    { step_key: "sc_d2_email", delay_days: 2, canal: "email", template_key: "reativacao-vitrine", mensagem: "E-mail: Vitrine de imóveis" },
    { step_key: "sc_d5_wa", delay_days: 5, canal: "whatsapp", template_name: "ultima_chance", mensagem: "WhatsApp: Última chance" },
  ],
  qualificacao: [
    { step_key: "q_d0_wa", delay_days: 0, canal: "whatsapp", template_name: "reativacao_vitrine", mensagem: "WhatsApp: Vitrine automática" },
    { step_key: "q_d3_email", delay_days: 3, canal: "email", template_key: "novidades-mercado", mensagem: "E-mail: Novidades + site novo" },
    { step_key: "q_d6_wa", delay_days: 6, canal: "whatsapp", template_name: "reativacao_vitrine", mensagem: "WhatsApp: Novo match" },
  ],
  reativacao: [
    { step_key: "r_d0_email", delay_days: 0, canal: "email", template_key: "novidades-mercado", mensagem: "E-mail: Novidades do mercado" },
    { step_key: "r_d3_wa", delay_days: 3, canal: "whatsapp", template_name: "reativacao_vitrine", mensagem: "WhatsApp: Novos imóveis" },
    { step_key: "r_d7_email", delay_days: 7, canal: "email", template_key: "ultimo-lembrete", mensagem: "E-mail: Último lembrete" },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const cutoffNurturing = new Date(now.getTime() - MIN_NURTURING_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    let totalScheduled = 0;
    let whatsappToday = 0;

    // Count WhatsApp already scheduled for today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const { count: waCount } = await supabase
      .from("lead_nurturing_sequences")
      .select("id", { count: "exact", head: true })
      .eq("canal", "whatsapp")
      .eq("status", "pendente")
      .gte("scheduled_at", todayStart.toISOString());
    whatsappToday = waCount || 0;

    // ── 1. Leads "Sem Contato" parados 48h+ ──
    const { data: semContatoLeads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, email, empreendimento, corretor_id")
      .eq("stage_tipo", "sem_contato")
      .lte("updated_at", cutoff48h)
      .limit(100);

    if (semContatoLeads) {
      for (const lead of semContatoLeads) {
        const scheduled = await scheduleSequence(lead, "sem_contato", cutoffNurturing, now);
        if (scheduled) totalScheduled += scheduled;
      }
    }

    // ── 2. Leads em "Qualificação" parados 72h+ ──
    const { data: qualLeads } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, email, empreendimento, corretor_id")
      .eq("stage_tipo", "qualificacao")
      .lte("updated_at", cutoff72h)
      .limit(100);

    if (qualLeads) {
      for (const lead of qualLeads) {
        const scheduled = await scheduleSequence(lead, "qualificacao", cutoffNurturing, now);
        if (scheduled) totalScheduled += scheduled;
      }
    }

    // ── 3. Leads Descartados (reativação base fria) ──
    const { data: descartados } = await supabase
      .from("pipeline_leads")
      .select("id, nome, telefone, email, empreendimento, corretor_id")
      .eq("stage_tipo", "descartado")
      .gte("updated_at", cutoff90d)
      .limit(200);

    if (descartados) {
      for (const lead of descartados) {
        if (whatsappToday >= MAX_WHATSAPP_PER_DAY) break;
        const scheduled = await scheduleSequence(lead, "reativacao", cutoffNurturing, now);
        if (scheduled) {
          totalScheduled += scheduled;
          whatsappToday++;
        }
      }
    }

    console.log(`Reactivate cold leads: ${totalScheduled} steps scheduled`);

    return new Response(
      JSON.stringify({ scheduled: totalScheduled, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Reactivate cold leads error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function scheduleSequence(
  lead: any,
  stageTipo: string,
  cutoffNurturing: string,
  now: Date,
): Promise<number> {
  // Check if lead was nurtured recently
  const { data: recent } = await supabase
    .from("lead_nurturing_sequences")
    .select("id")
    .eq("pipeline_lead_id", lead.id)
    .gte("created_at", cutoffNurturing)
    .limit(1);

  if (recent && recent.length > 0) return 0;

  // For email canal, lead must have email
  const hasEmail = !!lead.email;
  const hasPhone = !!lead.telefone;

  const steps = SEQUENCES[stageTipo];
  if (!steps) return 0;

  const rows = [];
  for (const step of steps) {
    // Skip if lead doesn't have the required channel
    if (step.canal === "email" && !hasEmail) continue;
    if (step.canal === "whatsapp" && !hasPhone) continue;

    const scheduledAt = new Date(now.getTime() + step.delay_days * 24 * 60 * 60 * 1000);

    rows.push({
      pipeline_lead_id: lead.id,
      step_key: step.step_key,
      stage_tipo: stageTipo,
      canal: step.canal,
      template_name: step.template_name || null,
      template_key: step.template_key || null,
      mensagem: step.mensagem,
      status: "pendente",
      scheduled_at: scheduledAt.toISOString(),
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("lead_nurturing_sequences")
    .insert(rows as any);

  if (error) {
    console.error(`Error scheduling for lead ${lead.id}:`, error);
    return 0;
  }

  return rows.length;
}
