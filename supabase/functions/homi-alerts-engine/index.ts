import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEDUP_WINDOW_HOURS = 12;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const stats = { leads_sem_contato: 0, lead_stuck_stage: 0, visita_sem_confirmacao: 0, corretor_inativo: 0, tarefa_vencida: 0, skipped_dedup: 0, errors: 0 };

  try {
    // Check overlap guard
    const { data: recentRun } = await db
      .from("ops_events")
      .select("id")
      .eq("event_type", "homi_alerts_engine_run_start")
      .gte("created_at", new Date(Date.now() - 8 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentRun) {
      return new Response(JSON.stringify({ skipped: "overlap_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark run start
    await db.from("ops_events").insert({
      event_type: "homi_alerts_engine_run_start",
      source: "homi-alerts-engine",
      level: "info",
      payload: {},
    });

    // Get all gestores/admins who should receive alerts
    const { data: managers } = await db
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "gestor"]);

    const managerIds = (managers || []).map(m => m.user_id);
    if (managerIds.length === 0) {
      return new Response(JSON.stringify({ skipped: "no_managers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alertsToInsert: any[] = [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Helper: add alert with dedup
    function addAlert(tipo: string, prioridade: string, mensagem: string, contexto: any, destIds: string[], dedupSuffix: string) {
      const dedupDate = todayStr; // daily dedup window
      for (const destId of destIds) {
        const dedup_key = `${tipo}:${dedupSuffix}:${destId}:${dedupDate}`;
        alertsToInsert.push({
          tipo,
          prioridade,
          mensagem,
          contexto,
          destinatario_id: destId,
          dedup_key,
        });
      }
    }

    // ── 1. Leads sem contato há >24h ──
    try {
      const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: leadsNoContact } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, stage_id, ultima_acao_at, created_at, modulo_atual")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .or(`ultima_acao_at.is.null,ultima_acao_at.lt.${cutoff24h}`)
        .lt("created_at", cutoff24h)
        .limit(50);

      for (const lead of leadsNoContact || []) {
        const hoursAgo = lead.ultima_acao_at
          ? Math.round((now.getTime() - new Date(lead.ultima_acao_at).getTime()) / 3600000)
          : Math.round((now.getTime() - new Date(lead.created_at).getTime()) / 3600000);
        
        addAlert(
          "leads_sem_contato",
          hoursAgo > 48 ? "critical" : "normal",
          `${lead.nome} está sem contato há ${hoursAgo}h`,
          { lead_id: lead.id, corretor_id: lead.corretor_id, horas_sem_contato: hoursAgo },
          managerIds,
          lead.id
        );
        stats.leads_sem_contato++;
      }
    } catch (e) { console.error("Alert scan [leads_sem_contato]:", e); stats.errors++; }

    // ── 2. Leads stuck no mesmo stage há >48h ──
    try {
      const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stuckLeads } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, stage_id, stage_changed_at, modulo_atual")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .lt("stage_changed_at", cutoff48h)
        .limit(50);

      for (const lead of stuckLeads || []) {
        const hoursStuck = Math.round((now.getTime() - new Date(lead.stage_changed_at).getTime()) / 3600000);
        addAlert(
          "lead_stuck_stage",
          hoursStuck > 96 ? "critical" : "normal",
          `${lead.nome} parado na mesma etapa há ${Math.round(hoursStuck / 24)}d`,
          { lead_id: lead.id, corretor_id: lead.corretor_id, stage_id: lead.stage_id, horas_parado: hoursStuck },
          managerIds,
          lead.id
        );
        stats.lead_stuck_stage++;
      }
    } catch (e) { console.error("Alert scan [lead_stuck_stage]:", e); stats.errors++; }

    // ── 3. Visitas agendadas para amanhã sem confirmação ──
    try {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const { data: unconfirmedVisits } = await db
        .from("visitas")
        .select("id, nome_cliente, corretor_id, data_visita, empreendimento, status")
        .eq("data_visita", tomorrowStr)
        .in("status", ["agendada", "pendente"])
        .is("confirmed_at", null)
        .limit(50);

      for (const v of unconfirmedVisits || []) {
        addAlert(
          "visita_sem_confirmacao",
          "critical",
          `Visita de ${v.nome_cliente} amanhã sem confirmação`,
          { visita_id: v.id, corretor_id: v.corretor_id, empreendimento: v.empreendimento, data_visita: v.data_visita },
          managerIds,
          v.id
        );
        stats.visita_sem_confirmacao++;
      }
    } catch (e) { console.error("Alert scan [visita_sem_confirmacao]:", e); stats.errors++; }

    // ── 4. Corretores sem atividade no CRM há >2h (durante horário comercial) ──
    try {
      const hour = now.getUTCHours() - 3; // BRT approximation
      if (hour >= 8 && hour <= 18) {
        const cutoff2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

        // Get active corretores (with recent pipeline_leads)
        const { data: activeCorretores } = await db
          .from("corretor_disponibilidade")
          .select("user_id")
          .eq("status", "online")
          .eq("na_roleta", true);

        if (activeCorretores && activeCorretores.length > 0) {
          for (const cd of activeCorretores) {
            // Check for any recent activity
            const { data: recentActivity } = await db
              .from("pipeline_leads")
              .select("id")
              .eq("corretor_id", cd.user_id)
              .gte("updated_at", cutoff2h)
              .limit(1)
              .maybeSingle();

            if (!recentActivity) {
              // Get corretor name
              const { data: profile } = await db
                .from("profiles")
                .select("nome")
                .eq("user_id", cd.user_id)
                .maybeSingle();

              addAlert(
                "corretor_inativo",
                "normal",
                `${profile?.nome || "Corretor"} está online mas sem atividade há 2h+`,
                { corretor_id: cd.user_id },
                managerIds,
                cd.user_id
              );
              stats.corretor_inativo++;
            }
          }
        }
      }
    } catch (e) { console.error("Alert scan [corretor_inativo]:", e); stats.errors++; }

    // ── 5. Tarefas vencidas não concluídas ──
    try {
      const { data: overdueTasks } = await db
        .from("pipeline_tarefas")
        .select("id, titulo, pipeline_lead_id, responsavel_id, vence_em, prioridade")
        .eq("status", "pendente")
        .lt("vence_em", todayStr)
        .limit(50);

      for (const t of overdueTasks || []) {
        const daysOverdue = Math.round((now.getTime() - new Date(t.vence_em!).getTime()) / 86400000);
        addAlert(
          "tarefa_vencida",
          daysOverdue > 3 ? "critical" : "normal",
          `Tarefa "${t.titulo}" vencida há ${daysOverdue}d`,
          { tarefa_id: t.id, pipeline_lead_id: t.pipeline_lead_id, responsavel_id: t.responsavel_id, dias_vencida: daysOverdue },
          managerIds,
          t.id
        );
        stats.tarefa_vencida++;
      }
    } catch (e) { console.error("Alert scan [tarefa_vencida]:", e); stats.errors++; }

    // ── Batch insert with dedup (ON CONFLICT DO NOTHING) ──
    let inserted = 0;
    if (alertsToInsert.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < alertsToInsert.length; i += 100) {
        const batch = alertsToInsert.slice(i, i + 100);
        const { data, error } = await db
          .from("homi_alerts")
          .upsert(batch, { onConflict: "dedup_key", ignoreDuplicates: true })
          .select("id");

        if (error) {
          console.error("Insert batch error:", error);
          stats.errors++;
        } else {
          inserted += (data?.length || 0);
          stats.skipped_dedup += batch.length - (data?.length || 0);
        }
      }
    }

    // Cleanup old alerts
    await db.rpc("cleanup_homi_alerts" as any);

    const durationMs = Date.now() - startMs;

    // Log completion
    await db.from("ops_events").insert({
      event_type: "homi_alerts_engine_run_end",
      source: "homi-alerts-engine",
      level: stats.errors > 0 ? "warn" : "info",
      payload: { ...stats, inserted, total_candidates: alertsToInsert.length, duration_ms: durationMs },
    });

    return new Response(JSON.stringify({ ok: true, stats, inserted, duration_ms: durationMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("homi-alerts-engine fatal:", e);
    await db.from("ops_events").insert({
      event_type: "homi_alerts_engine_error",
      source: "homi-alerts-engine",
      level: "error",
      payload: { error: e instanceof Error ? e.message : String(e), stats },
    }).catch(() => {});
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
