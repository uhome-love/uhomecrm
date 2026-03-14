import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEDUP_WINDOW_HOURS = 12;

function log(level: string, msg: string, ctx: Record<string, unknown> = {}) {
  const entry = { fn: "homi-alerts-engine", level, msg, ctx, ts: new Date().toISOString() };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);
  const traceId = `t-alerts-${Date.now().toString(36)}`;

  const stats = {
    leads_sem_contato: { candidates: 0, inserted: 0 },
    lead_stuck_stage: { candidates: 0, inserted: 0 },
    visita_sem_confirmacao: { candidates: 0, inserted: 0 },
    corretor_inativo: { candidates: 0, checked: 0, inserted: 0 },
    tarefa_vencida: { candidates: 0, inserted: 0 },
    total_candidates: 0,
    total_inserted: 0,
    skipped_dedup: 0,
    errors: 0,
    error_details: [] as string[],
  };

  try {
    // ── Overlap guard ──
    // Use correct ops_events columns: fn, category, message, ctx
    const { data: recentRun, error: overlapErr } = await db
      .from("ops_events")
      .select("id")
      .eq("fn", "homi-alerts-engine")
      .eq("category", "run_start")
      .gte("created_at", new Date(Date.now() - 8 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (overlapErr) {
      log("warn", "Overlap guard query failed, proceeding anyway", { error: overlapErr.message });
    }

    if (recentRun) {
      log("info", "Skipped: overlap guard", { recentRunId: recentRun.id });
      return new Response(JSON.stringify({ skipped: "overlap_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Mark run start ──
    const { error: markErr } = await db.from("ops_events").insert({
      fn: "homi-alerts-engine",
      level: "info",
      category: "run_start",
      message: "Alert engine scan started",
      trace_id: traceId,
      ctx: {},
    });
    if (markErr) {
      log("warn", "Failed to mark run start in ops_events", { error: markErr.message });
    }

    // ── Get managers ──
    const { data: managers, error: mgrErr } = await db
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "gestor"]);

    const managerIds = (managers || []).map(m => m.user_id);
    log("info", "Managers loaded", { count: managerIds.length, roles: managers?.map(m => m.role), error: mgrErr?.message });

    if (managerIds.length === 0) {
      log("warn", "No managers found — aborting");
      return new Response(JSON.stringify({ skipped: "no_managers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alertsToInsert: any[] = [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Helper: add alert with dedup
    function addAlert(tipo: string, prioridade: string, mensagem: string, contexto: any, destIds: string[], dedupSuffix: string) {
      const dedupDate = todayStr;
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

    // ══════════════════════════════════════════════
    // 1. Leads sem contato há >24h
    // ══════════════════════════════════════════════
    try {
      const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: leadsNoContact, error: q1Err } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, stage_id, ultima_acao_at, created_at, modulo_atual")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .or(`ultima_acao_at.is.null,ultima_acao_at.lt.${cutoff24h}`)
        .lt("created_at", cutoff24h)
        .limit(50);

      const count = leadsNoContact?.length || 0;
      stats.leads_sem_contato.candidates = count;
      log("info", "Scan [leads_sem_contato]", { candidates: count, error: q1Err?.message, cutoff: cutoff24h });

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
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "Scan [leads_sem_contato] exception", { error: msg });
      stats.errors++;
      stats.error_details.push(`leads_sem_contato: ${msg}`);
    }

    // ══════════════════════════════════════════════
    // 2. Leads stuck no mesmo stage há >48h
    // ══════════════════════════════════════════════
    try {
      const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stuckLeads, error: q2Err } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, stage_id, stage_changed_at, modulo_atual")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .lt("stage_changed_at", cutoff48h)
        .limit(50);

      const count = stuckLeads?.length || 0;
      stats.lead_stuck_stage.candidates = count;
      log("info", "Scan [lead_stuck_stage]", { candidates: count, error: q2Err?.message, cutoff: cutoff48h });

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
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "Scan [lead_stuck_stage] exception", { error: msg });
      stats.errors++;
      stats.error_details.push(`lead_stuck_stage: ${msg}`);
    }

    // ══════════════════════════════════════════════
    // 3. Visitas agendadas para amanhã sem confirmação
    // ══════════════════════════════════════════════
    try {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const { data: unconfirmedVisits, error: q3Err } = await db
        .from("visitas")
        .select("id, nome_cliente, corretor_id, data_visita, empreendimento, status")
        .eq("data_visita", tomorrowStr)
        .in("status", ["agendada", "pendente"])
        .is("confirmed_at", null)
        .limit(50);

      const count = unconfirmedVisits?.length || 0;
      stats.visita_sem_confirmacao.candidates = count;
      log("info", "Scan [visita_sem_confirmacao]", { candidates: count, error: q3Err?.message, tomorrow: tomorrowStr });

      for (const v of unconfirmedVisits || []) {
        addAlert(
          "visita_sem_confirmacao",
          "critical",
          `Visita de ${v.nome_cliente} amanhã sem confirmação`,
          { visita_id: v.id, corretor_id: v.corretor_id, empreendimento: v.empreendimento, data_visita: v.data_visita },
          managerIds,
          v.id
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "Scan [visita_sem_confirmacao] exception", { error: msg });
      stats.errors++;
      stats.error_details.push(`visita_sem_confirmacao: ${msg}`);
    }

    // ══════════════════════════════════════════════
    // 4. Corretores sem atividade no CRM há >2h
    // ══════════════════════════════════════════════
    try {
      const hour = now.getUTCHours() - 3; // BRT approximation
      log("info", "Scan [corretor_inativo] time check", { utcHour: now.getUTCHours(), brtHour: hour, inBusinessHours: hour >= 8 && hour <= 18 });

      if (hour >= 8 && hour <= 18) {
        const cutoff2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

        const { data: activeCorretores, error: q4Err } = await db
          .from("corretor_disponibilidade")
          .select("user_id")
          .eq("status", "online")
          .eq("na_roleta", true);

        const onlineCount = activeCorretores?.length || 0;
        stats.corretor_inativo.checked = onlineCount;
        log("info", "Scan [corretor_inativo] online brokers", { online: onlineCount, error: q4Err?.message });

        if (activeCorretores && activeCorretores.length > 0) {
          for (const cd of activeCorretores) {
            const { data: recentActivity } = await db
              .from("pipeline_leads")
              .select("id")
              .eq("corretor_id", cd.user_id)
              .gte("updated_at", cutoff2h)
              .limit(1)
              .maybeSingle();

            if (!recentActivity) {
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
              stats.corretor_inativo.candidates++;
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "Scan [corretor_inativo] exception", { error: msg });
      stats.errors++;
      stats.error_details.push(`corretor_inativo: ${msg}`);
    }

    // ══════════════════════════════════════════════
    // 5. Tarefas vencidas não concluídas
    // ══════════════════════════════════════════════
    try {
      const { data: overdueTasks, error: q5Err } = await db
        .from("pipeline_tarefas")
        .select("id, titulo, pipeline_lead_id, responsavel_id, vence_em, prioridade")
        .eq("status", "pendente")
        .lt("vence_em", todayStr)
        .limit(50);

      const count = overdueTasks?.length || 0;
      stats.tarefa_vencida.candidates = count;
      log("info", "Scan [tarefa_vencida]", { candidates: count, error: q5Err?.message, cutoff: todayStr });

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
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "Scan [tarefa_vencida] exception", { error: msg });
      stats.errors++;
      stats.error_details.push(`tarefa_vencida: ${msg}`);
    }

    // ══════════════════════════════════════════════
    // Batch insert with dedup
    // ══════════════════════════════════════════════
    stats.total_candidates = alertsToInsert.length;
    log("info", "Insert phase", { total_candidates: alertsToInsert.length, managers: managerIds.length, alerts_per_manager: managerIds.length > 0 ? Math.round(alertsToInsert.length / managerIds.length) : 0 });

    let totalInserted = 0;
    let totalSkipped = 0;

    if (alertsToInsert.length > 0) {
      for (let i = 0; i < alertsToInsert.length; i += 100) {
        const batch = alertsToInsert.slice(i, i + 100);
        const batchNum = Math.floor(i / 100) + 1;

        const { data, error, count: upsertCount } = await db
          .from("homi_alerts")
          .upsert(batch, { onConflict: "dedup_key", ignoreDuplicates: true })
          .select("id");

        const insertedCount = data?.length || 0;
        const skippedCount = batch.length - insertedCount;
        totalInserted += insertedCount;
        totalSkipped += skippedCount;

        if (error) {
          log("error", `Insert batch ${batchNum} failed`, { error: error.message, code: error.code, batchSize: batch.length });
          stats.errors++;
          stats.error_details.push(`insert_batch_${batchNum}: ${error.message}`);
        } else {
          log("info", `Insert batch ${batchNum} complete`, { batchSize: batch.length, inserted: insertedCount, skipped_dedup: skippedCount });
        }
      }
    } else {
      log("info", "0 eligible alerts — nothing to insert");
    }

    stats.total_inserted = totalInserted;
    stats.skipped_dedup = totalSkipped;

    // Update per-type inserted counts (approximate based on candidates)
    // This is a simplification — exact per-type tracking would require separate upserts
    log("info", "Insert summary", { total_inserted: totalInserted, total_skipped: totalSkipped, total_candidates: stats.total_candidates });

    // Cleanup old alerts
    try {
      await db.rpc("cleanup_homi_alerts" as any);
      log("info", "Cleanup completed");
    } catch (e) {
      log("warn", "Cleanup failed", { error: e instanceof Error ? e.message : String(e) });
    }

    const durationMs = Date.now() - startMs;

    // ── Final run summary ──
    const summary = {
      trace_id: traceId,
      duration_ms: durationMs,
      managers: managerIds.length,
      scans: {
        leads_sem_contato: stats.leads_sem_contato.candidates,
        lead_stuck_stage: stats.lead_stuck_stage.candidates,
        visita_sem_confirmacao: stats.visita_sem_confirmacao.candidates,
        corretor_inativo: `${stats.corretor_inativo.candidates} inactive of ${stats.corretor_inativo.checked} online`,
        tarefa_vencida: stats.tarefa_vencida.candidates,
      },
      total_candidates: stats.total_candidates,
      total_inserted: totalInserted,
      skipped_dedup: totalSkipped,
      errors: stats.errors,
    };

    log("info", "Run complete", summary);

    // Persist to ops_events with CORRECT column names
    await db.from("ops_events").insert({
      fn: "homi-alerts-engine",
      level: stats.errors > 0 ? "warn" : "info",
      category: "run_end",
      message: `Alerts: ${totalInserted} inserted, ${totalSkipped} deduped, ${stats.total_candidates} candidates, ${stats.errors} errors`,
      trace_id: traceId,
      ctx: summary,
    }).catch(e => log("warn", "Failed to persist run summary", { error: String(e) }));

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log("error", "Fatal error", { error: errMsg, stats });

    await db.from("ops_events").insert({
      fn: "homi-alerts-engine",
      level: "error",
      category: "fatal",
      message: `Fatal: ${errMsg}`,
      trace_id: traceId,
      ctx: { error: errMsg, stats },
    }).catch(() => {});

    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
