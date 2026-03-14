import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ═══════════ Thresholds ═══════════ */
const THRESHOLDS = {
  leads_sem_contato: { min_count: 5, warn_count: 10 },  // per broker
  lead_stuck_stage:  { min_count: 3, warn_count: 8  },
  tarefa_vencida:    { min_count: 3, warn_count: 8  },
};

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
    leads_sem_contato: { brokers_scanned: 0, brokers_alerted: 0, total_leads: 0 },
    lead_stuck_stage:  { brokers_scanned: 0, brokers_alerted: 0, total_leads: 0 },
    tarefa_vencida:    { brokers_scanned: 0, brokers_alerted: 0, total_tasks: 0 },
    visita_sem_confirmacao: { candidates: 0 },
    corretor_inativo: { online: 0, inactive_with_workload: 0 },
    total_inserted: 0,
    skipped_dedup: 0,
    errors: 0,
  };

  try {
    // ── Overlap guard ──
    const { data: recentRun } = await db
      .from("ops_events")
      .select("id")
      .eq("fn", "homi-alerts-engine")
      .eq("category", "run_start")
      .gte("created_at", new Date(Date.now() - 8 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentRun) {
      log("info", "Skipped: overlap guard");
      return new Response(JSON.stringify({ skipped: "overlap_guard" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await db.from("ops_events").insert({
      fn: "homi-alerts-engine", level: "info", category: "run_start",
      message: "Alert engine scan started", trace_id: traceId, ctx: {},
    });

    // ── Load managers & team structure ──
    const { data: managers } = await db
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "gestor"]);

    const managerIds = (managers || []).map(m => m.user_id);
    const adminIds = (managers || []).filter(m => m.role === "admin").map(m => m.user_id);

    if (managerIds.length === 0) {
      log("warn", "No managers found — aborting");
      return new Response(JSON.stringify({ skipped: "no_managers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load team_members for broker→manager mapping
    const { data: teamMembers } = await db
      .from("team_members")
      .select("user_id, gerente_id, nome")
      .eq("status", "ativo");

    // Map: broker auth_user_id → { gerente_id, nome }
    const brokerToManager = new Map<string, { gerente_id: string; nome: string }>();
    for (const tm of teamMembers || []) {
      if (tm.user_id) brokerToManager.set(tm.user_id, { gerente_id: tm.gerente_id, nome: tm.nome });
    }

    // Load broker profile names (fallback)
    const brokerIds = [...new Set([...(teamMembers || []).map(t => t.user_id).filter(Boolean)])];
    const { data: profiles } = await db
      .from("profiles")
      .select("user_id, nome")
      .in("user_id", brokerIds.length > 0 ? brokerIds : ["__none__"]);

    const profileNames = new Map<string, string>();
    for (const p of profiles || []) profileNames.set(p.user_id, p.nome);

    function getBrokerName(userId: string): string {
      return brokerToManager.get(userId)?.nome || profileNames.get(userId) || "Corretor";
    }

    // Determine who gets an alert: the broker's manager + all admins
    function getDestinataireIds(brokerId: string): string[] {
      const mgr = brokerToManager.get(brokerId);
      const ids = new Set<string>(adminIds);
      if (mgr?.gerente_id) ids.add(mgr.gerente_id);
      return [...ids];
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const alertsToInsert: any[] = [];

    function addAlert(tipo: string, prioridade: string, mensagem: string, contexto: any, destIds: string[], dedupSuffix: string) {
      for (const destId of destIds) {
        const dedup_key = `${tipo}:${dedupSuffix}:${destId}:${todayStr}`;
        alertsToInsert.push({ tipo, prioridade, mensagem, contexto, destinatario_id: destId, dedup_key });
      }
    }

    log("info", "Context loaded", { managers: managerIds.length, admins: adminIds.length, teamMembers: (teamMembers || []).length });

    // ══════════════════════════════════════════════════════════
    // 1. Leads sem contato >24h — AGGREGATED BY BROKER
    // ══════════════════════════════════════════════════════════
    try {
      const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: leadsNoContact, error: q1Err } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, ultima_acao_at, created_at")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .or(`ultima_acao_at.is.null,ultima_acao_at.lt.${cutoff24h}`)
        .lt("created_at", cutoff24h)
        .limit(500);

      if (q1Err) log("warn", "Query error [leads_sem_contato]", { error: q1Err.message });

      // Group by corretor
      const byBroker = new Map<string, { count: number; maxHours: number; leadNames: string[] }>();
      for (const lead of leadsNoContact || []) {
        if (!lead.corretor_id) continue;
        const hours = lead.ultima_acao_at
          ? Math.round((now.getTime() - new Date(lead.ultima_acao_at).getTime()) / 3600000)
          : Math.round((now.getTime() - new Date(lead.created_at).getTime()) / 3600000);
        const entry = byBroker.get(lead.corretor_id) || { count: 0, maxHours: 0, leadNames: [] };
        entry.count++;
        entry.maxHours = Math.max(entry.maxHours, hours);
        if (entry.leadNames.length < 3) entry.leadNames.push(lead.nome);
        byBroker.set(lead.corretor_id, entry);
      }

      stats.leads_sem_contato.brokers_scanned = byBroker.size;
      stats.leads_sem_contato.total_leads = leadsNoContact?.length || 0;

      for (const [brokerId, data] of byBroker) {
        const { min_count, warn_count } = THRESHOLDS.leads_sem_contato;
        if (data.count < min_count) continue; // below threshold → no alert

        const brokerName = getBrokerName(brokerId);
        const severity = data.count >= warn_count || data.maxHours > 72 ? "critical" : "normal";
        const preview = data.leadNames.join(", ") + (data.count > 3 ? ` +${data.count - 3}` : "");

        addAlert(
          "leads_sem_contato", severity,
          `${brokerName} tem ${data.count} leads sem contato (até ${data.maxHours}h) — ${preview}`,
          { corretor_id: brokerId, count: data.count, max_hours: data.maxHours, sample_names: data.leadNames },
          getDestinataireIds(brokerId),
          brokerId // dedup per broker per day
        );
        stats.leads_sem_contato.brokers_alerted++;
      }

      log("info", "Scan [leads_sem_contato]", {
        total_leads: leadsNoContact?.length || 0,
        brokers: byBroker.size,
        alerted: stats.leads_sem_contato.brokers_alerted,
        threshold: THRESHOLDS.leads_sem_contato.min_count,
      });
    } catch (e) {
      log("error", "Scan [leads_sem_contato] exception", { error: (e as Error).message });
      stats.errors++;
    }

    // ══════════════════════════════════════════════════════════
    // 2. Leads stuck >48h — AGGREGATED BY BROKER
    // ══════════════════════════════════════════════════════════
    try {
      const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stuckLeads, error: q2Err } = await db
        .from("pipeline_leads")
        .select("id, nome, corretor_id, stage_id, stage_changed_at")
        .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")")
        .eq("aceite_status", "aceito")
        .lt("stage_changed_at", cutoff48h)
        .limit(500);

      if (q2Err) log("warn", "Query error [lead_stuck_stage]", { error: q2Err.message });

      const byBroker = new Map<string, { count: number; maxDays: number; leadNames: string[] }>();
      for (const lead of stuckLeads || []) {
        if (!lead.corretor_id) continue;
        const days = Math.round((now.getTime() - new Date(lead.stage_changed_at).getTime()) / 86400000);
        const entry = byBroker.get(lead.corretor_id) || { count: 0, maxDays: 0, leadNames: [] };
        entry.count++;
        entry.maxDays = Math.max(entry.maxDays, days);
        if (entry.leadNames.length < 3) entry.leadNames.push(lead.nome);
        byBroker.set(lead.corretor_id, entry);
      }

      stats.lead_stuck_stage.brokers_scanned = byBroker.size;
      stats.lead_stuck_stage.total_leads = stuckLeads?.length || 0;

      for (const [brokerId, data] of byBroker) {
        const { min_count, warn_count } = THRESHOLDS.lead_stuck_stage;
        if (data.count < min_count) continue;

        const brokerName = getBrokerName(brokerId);
        const severity = data.count >= warn_count || data.maxDays > 7 ? "critical" : "normal";

        addAlert(
          "lead_stuck_stage", severity,
          `${brokerName} tem ${data.count} leads parados há +48h (pior: ${data.maxDays}d)`,
          { corretor_id: brokerId, count: data.count, max_days: data.maxDays, sample_names: data.leadNames },
          getDestinataireIds(brokerId),
          brokerId
        );
        stats.lead_stuck_stage.brokers_alerted++;
      }

      log("info", "Scan [lead_stuck_stage]", {
        total_leads: stuckLeads?.length || 0,
        brokers: byBroker.size,
        alerted: stats.lead_stuck_stage.brokers_alerted,
      });
    } catch (e) {
      log("error", "Scan [lead_stuck_stage] exception", { error: (e as Error).message });
      stats.errors++;
    }

    // ══════════════════════════════════════════════════════════
    // 3. Visitas amanhã sem confirmação — INDIVIDUAL (critical)
    // ══════════════════════════════════════════════════════════
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

      if (q3Err) log("warn", "Query error [visita_sem_confirmacao]", { error: q3Err.message });

      stats.visita_sem_confirmacao.candidates = unconfirmedVisits?.length || 0;

      for (const v of unconfirmedVisits || []) {
        const brokerName = getBrokerName(v.corretor_id);
        addAlert(
          "visita_sem_confirmacao", "critical",
          `Visita de ${v.nome_cliente} (${v.empreendimento || "—"}) amanhã — ${brokerName} não confirmou`,
          { visita_id: v.id, corretor_id: v.corretor_id, empreendimento: v.empreendimento, data_visita: v.data_visita },
          getDestinataireIds(v.corretor_id),
          v.id
        );
      }

      log("info", "Scan [visita_sem_confirmacao]", { candidates: unconfirmedVisits?.length || 0, tomorrow: tomorrowStr });
    } catch (e) {
      log("error", "Scan [visita_sem_confirmacao] exception", { error: (e as Error).message });
      stats.errors++;
    }

    // ══════════════════════════════════════════════════════════
    // 4. Corretor inativo — INDIVIDUAL (only if has pending work)
    // ══════════════════════════════════════════════════════════
    try {
      const hour = now.getUTCHours() - 3; // BRT approximation
      if (hour >= 8 && hour <= 18) {
        const cutoff2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

        const { data: activeCorretores } = await db
          .from("corretor_disponibilidade")
          .select("user_id")
          .eq("status", "online")
          .eq("na_roleta", true);

        stats.corretor_inativo.online = activeCorretores?.length || 0;

        for (const cd of activeCorretores || []) {
          // Check for recent activity
          const { data: recentActivity } = await db
            .from("pipeline_leads")
            .select("id")
            .eq("corretor_id", cd.user_id)
            .gte("updated_at", cutoff2h)
            .limit(1)
            .maybeSingle();

          if (recentActivity) continue; // has activity → skip

          // Check if broker has pending workload (leads awaiting action)
          const { count: pendingCount } = await db
            .from("pipeline_leads")
            .select("id", { count: "exact", head: true })
            .eq("corretor_id", cd.user_id)
            .eq("aceite_status", "aceito")
            .not("modulo_atual", "in", "(\"pos_vendas\",\"descarte\")");

          if (!pendingCount || pendingCount < 3) continue; // no meaningful workload → skip

          const brokerName = getBrokerName(cd.user_id);
          addAlert(
            "corretor_inativo", "normal",
            `${brokerName} está online há 2h+ sem atividade (${pendingCount} leads pendentes)`,
            { corretor_id: cd.user_id, pending_leads: pendingCount },
            getDestinataireIds(cd.user_id),
            cd.user_id
          );
          stats.corretor_inativo.inactive_with_workload++;
        }

        log("info", "Scan [corretor_inativo]", { online: stats.corretor_inativo.online, inactive_with_workload: stats.corretor_inativo.inactive_with_workload, brtHour: hour });
      } else {
        log("info", "Scan [corretor_inativo] skipped — outside business hours", { brtHour: hour });
      }
    } catch (e) {
      log("error", "Scan [corretor_inativo] exception", { error: (e as Error).message });
      stats.errors++;
    }

    // ══════════════════════════════════════════════════════════
    // 5. Tarefas vencidas — AGGREGATED BY BROKER
    // ══════════════════════════════════════════════════════════
    try {
      const { data: overdueTasks, error: q5Err } = await db
        .from("pipeline_tarefas")
        .select("id, titulo, pipeline_lead_id, responsavel_id, vence_em")
        .eq("status", "pendente")
        .lt("vence_em", todayStr)
        .limit(500);

      if (q5Err) log("warn", "Query error [tarefa_vencida]", { error: q5Err.message });

      const byBroker = new Map<string, { count: number; maxDays: number; titles: string[] }>();
      for (const t of overdueTasks || []) {
        if (!t.responsavel_id) continue;
        const days = Math.round((now.getTime() - new Date(t.vence_em!).getTime()) / 86400000);
        const entry = byBroker.get(t.responsavel_id) || { count: 0, maxDays: 0, titles: [] };
        entry.count++;
        entry.maxDays = Math.max(entry.maxDays, days);
        if (entry.titles.length < 2) entry.titles.push(t.titulo);
        byBroker.set(t.responsavel_id, entry);
      }

      stats.tarefa_vencida.brokers_scanned = byBroker.size;
      stats.tarefa_vencida.total_tasks = overdueTasks?.length || 0;

      for (const [brokerId, data] of byBroker) {
        const { min_count, warn_count } = THRESHOLDS.tarefa_vencida;
        if (data.count < min_count) continue;

        const brokerName = getBrokerName(brokerId);
        const severity = data.count >= warn_count || data.maxDays > 5 ? "critical" : "normal";

        addAlert(
          "tarefa_vencida", severity,
          `${brokerName} tem ${data.count} tarefa(s) vencida(s) (até ${data.maxDays}d atrás)`,
          { corretor_id: brokerId, count: data.count, max_days: data.maxDays, sample_titles: data.titles },
          getDestinataireIds(brokerId),
          brokerId
        );
        stats.tarefa_vencida.brokers_alerted++;
      }

      log("info", "Scan [tarefa_vencida]", {
        total_tasks: overdueTasks?.length || 0,
        brokers: byBroker.size,
        alerted: stats.tarefa_vencida.brokers_alerted,
      });
    } catch (e) {
      log("error", "Scan [tarefa_vencida] exception", { error: (e as Error).message });
      stats.errors++;
    }

    // ══════════════════════════════════════════════════════════
    // Batch insert with dedup
    // ══════════════════════════════════════════════════════════
    const totalCandidates = alertsToInsert.length;
    log("info", "Insert phase", { total_candidates: totalCandidates });

    let totalInserted = 0;
    let totalSkipped = 0;

    if (totalCandidates > 0) {
      for (let i = 0; i < alertsToInsert.length; i += 100) {
        const batch = alertsToInsert.slice(i, i + 100);
        const { data, error } = await db
          .from("homi_alerts")
          .upsert(batch, { onConflict: "dedup_key", ignoreDuplicates: true })
          .select("id");

        const insertedCount = data?.length || 0;
        totalInserted += insertedCount;
        totalSkipped += batch.length - insertedCount;

        if (error) {
          log("error", "Insert batch failed", { error: error.message, batchSize: batch.length });
          stats.errors++;
        }
      }
    } else {
      log("info", "0 eligible alerts — nothing to insert");
    }

    stats.total_inserted = totalInserted;
    stats.skipped_dedup = totalSkipped;

    // Cleanup old alerts
    try { await db.rpc("cleanup_homi_alerts" as any); } catch (_) { /* ok */ }

    const durationMs = Date.now() - startMs;
    const summary = { trace_id: traceId, duration_ms: durationMs, ...stats, total_candidates: totalCandidates };

    log("info", "Run complete", summary);

    await db.from("ops_events").insert({
      fn: "homi-alerts-engine", level: stats.errors > 0 ? "warn" : "info",
      category: "run_end", trace_id: traceId,
      message: `Alerts: ${totalInserted} new, ${totalSkipped} deduped, ${totalCandidates} candidates`,
      ctx: summary,
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const errMsg = (e as Error).message || String(e);
    log("error", "Fatal error", { error: errMsg });
    await db.from("ops_events").insert({
      fn: "homi-alerts-engine", level: "error", category: "fatal",
      message: `Fatal: ${errMsg}`, trace_id: traceId, ctx: { error: errMsg },
    }).catch(() => {});
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
