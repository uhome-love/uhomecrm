// =============================================================================
// Edge Function: nurturing-orchestrator
// Cérebro central event-driven do sistema de nutrição
// Recebe eventos de qualquer canal, aplica scoring e decide próxima ação
// Inclui decisão inteligente via IA para leads quentes
// Bloco 1: Sets conversation_window_until on whatsapp_respondeu
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

// ── Lead Scoring Table ──
const SCORE_MAP: Record<string, number> = {
  whatsapp_entregue: 1,
  whatsapp_lido: 3,
  whatsapp_respondeu: 15,
  email_enviado: 1,
  email_aberto: 3,
  email_clicou: 8,
  vitrine_visualizada: 10,
  imovel_clicado: 12,
  voz_atendida: 20,
  voz_nao_atendeu: 0,
  pediu_remocao: -50,
  sem_interacao_7d: -5,
  sem_interacao_14d: -10,
  lead_criado: 0,
  lead_moveu_etapa: 0,
  corretor_tarefa_feita: 5,
};

const SCORE_QUENTE = 30;
const SCORE_MORNO = 15;

interface OrchestratorEvent {
  event_type: string;
  pipeline_lead_id: string;
  canal?: string;
  metadata?: Record<string, any>;
}

// ── AI-powered follow-up suggestion for hot leads ──
async function generateAISuggestion(lead: any, score: number, eventType: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const prompt = `Você é um assistente de vendas imobiliárias. Um lead chamado "${lead.nome || 'Lead'}" atingiu score ${score} no sistema de nutrição.
Empreendimento de interesse: ${lead.empreendimento || 'não especificado'}.
Último evento: ${eventType}.

Sugira em 2-3 frases curtas a melhor abordagem para o corretor entrar em contato AGORA. Seja direto e prático. Inclua sugestão de canal (WhatsApp, ligação ou email) e tom da mensagem.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você é HOMI, assistente de vendas imobiliárias da UHome. Responda em português brasileiro, de forma direta e prática." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("AI suggestion error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // ── Health-check / manual test mode ──
    if (body.source === "manual" || body.healthcheck) {
      return new Response(JSON.stringify({ status: "ok", message: "Orchestrator is running" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_type, pipeline_lead_id, canal, metadata } = body as OrchestratorEvent;

    if (!event_type || !pipeline_lead_id) {
      return new Response(JSON.stringify({ error: "event_type and pipeline_lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get or create nurturing state
    let { data: state } = await supabase
      .from("lead_nurturing_state")
      .select("*")
      .eq("pipeline_lead_id", pipeline_lead_id)
      .single();

    if (!state) {
      const { data: newState, error: insertErr } = await supabase
        .from("lead_nurturing_state")
        .insert({
          pipeline_lead_id,
          sequencia_ativa: metadata?.sequencia || "sem_contato",
          status: "ativo",
          lead_score: 0,
        })
        .select()
        .single();

      if (insertErr) {
        const { data: existing } = await supabase
          .from("lead_nurturing_state")
          .select("*")
          .eq("pipeline_lead_id", pipeline_lead_id)
          .single();
        state = existing;
      } else {
        state = newState;
      }
    }

    if (!state) {
      return new Response(JSON.stringify({ error: "Could not get/create state" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Apply scoring
    const scoreChange = SCORE_MAP[event_type] ?? 0;
    const newScore = (state.lead_score || 0) + scoreChange;

    // 3. Build updates
    const updates: Record<string, any> = {
      lead_score: newScore,
      ultimo_evento: event_type,
      ultimo_evento_at: new Date().toISOString(),
      canal_ultimo: canal || state.canal_ultimo,
      tentativas_contato: (state.tentativas_contato || 0) + (canal ? 1 : 0),
      updated_at: new Date().toISOString(),
    };

    if (event_type === "voz_atendida" || event_type === "voz_nao_atendeu") {
      updates.tentativas_voz = (state.tentativas_voz || 0) + 1;
    }

    // 4. Handle special events
    let action: string | null = null;

    // ── Bloco 1: Set 24h conversation window on reply ──
    if (event_type === "whatsapp_respondeu") {
      const windowUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("pipeline_leads")
        .update({ conversation_window_until: windowUntil })
        .eq("id", pipeline_lead_id);
    }

    // Lead responded → pause sequence, notify corretor
    if (["whatsapp_respondeu", "voz_atendida"].includes(event_type)) {
      updates.status = "respondeu";
      action = "notify_corretor";

      await supabase
        .from("lead_nurturing_sequences")
        .update({ status: "cancelado" } as any)
        .eq("pipeline_lead_id", pipeline_lead_id)
        .eq("status", "pendente");
    }

    // Opt-out
    if (event_type === "pediu_remocao" || newScore < 0) {
      updates.status = "opt_out";
      action = "stop_all";

      await supabase
        .from("lead_nurturing_sequences")
        .update({ status: "cancelado" } as any)
        .eq("pipeline_lead_id", pipeline_lead_id)
        .eq("status", "pendente");
    }

    // Score thresholds
    if (newScore >= SCORE_QUENTE && state.status === "ativo") {
      action = "notify_corretor_hot";
    }

    // Hot lead in reactivation → redistribute
    if (newScore >= SCORE_QUENTE && state.sequencia_ativa === "reativacao") {
      action = "redistribute";
      updates.status = "converteu";

      const { data: lead } = await supabase
        .from("pipeline_leads")
        .select("nome, corretor_id, empreendimento")
        .eq("id", pipeline_lead_id)
        .single();

      if (lead?.corretor_id) {
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id,
          tipo: "nurturing_sequencia",
          titulo: `🔥 Lead REATIVADO pela IA — ${lead.nome || "Lead"}`,
          descricao: `Lead descartado reativou com score ${newScore}. Contato imediato recomendado!`,
          data: new Date().toLocaleDateString("en-CA"),
          prioridade: "alta",
          status: "pendente",
          created_by: lead.corretor_id,
        });
      }
    }

    // 6. Notify corretor for hot leads + AI suggestion
    if (action === "notify_corretor" || action === "notify_corretor_hot") {
      const { data: lead } = await supabase
        .from("pipeline_leads")
        .select("nome, corretor_id, empreendimento")
        .eq("id", pipeline_lead_id)
        .single();

      if (lead?.corretor_id) {
        let aiSuggestion: string | null = null;
        if (newScore >= SCORE_MORNO) {
          aiSuggestion = await generateAISuggestion(lead, newScore, event_type);
        }

        const title = action === "notify_corretor_hot"
          ? `🔥 Lead QUENTE: ${lead.nome || "Lead"} (score ${newScore})`
          : `💬 ${lead.nome || "Lead"} respondeu via ${canal || "automação"}`;

        const descParts = [`Evento: ${event_type}. Score atual: ${newScore}. Contato humano recomendado.`];
        if (aiSuggestion) descParts.push(`\n🤖 Sugestão IA: ${aiSuggestion}`);

        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id,
          tipo: "nurturing_sequencia",
          titulo: title,
          descricao: descParts.join(""),
          data: new Date().toLocaleDateString("en-CA"),
          prioridade: newScore >= SCORE_QUENTE ? "alta" : "media",
          status: "pendente",
          created_by: lead.corretor_id,
        });

        if (aiSuggestion) {
          await supabase.from("pipeline_atividades").insert({
            pipeline_lead_id,
            tipo: "nurturing_sequencia",
            titulo: `🤖 Sugestão IA para abordagem`,
            descricao: aiSuggestion,
            data: new Date().toLocaleDateString("en-CA"),
            prioridade: "baixa",
            status: "concluida",
            created_by: "00000000-0000-0000-0000-000000000000",
          });
        }
      }
    }

    // 7. Update state
    await supabase.from("lead_nurturing_state").update(updates).eq("id", state.id);

    // 8. Log in timeline
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id,
      tipo: "nurturing_sequencia",
      titulo: `🤖 Evento: ${event_type}`,
      descricao: `Score: ${state.lead_score || 0} → ${newScore} (${scoreChange >= 0 ? "+" : ""}${scoreChange}). Canal: ${canal || "sistema"}`,
      data: new Date().toLocaleDateString("en-CA"),
      prioridade: "baixa",
      status: "concluida",
      created_by: "00000000-0000-0000-0000-000000000000",
    });

    console.log(`Orchestrator: lead=${pipeline_lead_id} event=${event_type} score=${state.lead_score}→${newScore} action=${action}`);

    return new Response(
      JSON.stringify({
        lead_id: pipeline_lead_id,
        event_type,
        score_before: state.lead_score,
        score_after: newScore,
        action,
        status: updates.status || state.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Orchestrator error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
