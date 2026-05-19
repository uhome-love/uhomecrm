// edge-health-alert
// Vigilância passiva 24/7 da saúde de edge functions.
//
// A cada hora:
//   1. Agrega ops_events últimas 24h via RPC edge_health_aggregate.
//   2. Pra cada function com >10 calls e >50% de erro:
//      - Checa dedup (alerta nas últimas 24h pra essa function)
//      - Se novo: insere notification sla_urgente pra admins + log de alert.
//   3. Pra cada function previously-alerted que voltou ao normal,
//      registra info "edge-health-recovered" (silencioso, sem notification).
//
// Auth: mesmo padrão dos outros crons HTTP do projeto — verify_jwt=false,
// sem validação custom. Risco aceito (idempotente, dedup 24h, sem dados
// sensíveis). Trans-funcional fica no backlog Fase 0.5.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_CALLS_24H = 10;
const ERROR_RATE_THRESHOLD = 0.5;
const WINDOW_HOURS = 24;

interface AggRow {
  fn: string;
  total_calls: number;
  error_calls: number;
  error_rate: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Agregar via RPC server-side (rápido, ~100ms)
    const { data: statsRaw, error: aggErr } = await supabase.rpc(
      "edge_health_aggregate",
      { p_hours: WINDOW_HOURS, p_min_calls: MIN_CALLS_24H },
    );
    if (aggErr) throw aggErr;

    const stats: AggRow[] = (statsRaw ?? []).map((r: AggRow) => ({
      ...r,
      error_rate: Number(r.error_rate),
      total_calls: Number(r.total_calls),
      error_calls: Number(r.error_calls),
    }));

    const problematic = stats.filter((s) => s.error_rate > ERROR_RATE_THRESHOLD);
    const healthy = stats.filter((s) => s.error_rate <= ERROR_RATE_THRESHOLD);

    // 2. Quais functions já foram alertadas nas últimas 24h
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data: priorAlerts } = await supabase
      .from("ops_events")
      .select("ctx")
      .eq("fn", "edge-health-alert")
      .eq("category", "alert")
      .gte("created_at", since);

    const alertedSet = new Set<string>(
      (priorAlerts ?? [])
        .map((r: { ctx: { function_alerted?: string } | null }) =>
          r.ctx?.function_alerted
        )
        .filter((x): x is string => typeof x === "string"),
    );

    // 3. Admins (apenas se houver algo problemático novo)
    let admins: { user_id: string }[] = [];
    const newProblematic = problematic.filter((p) => !alertedSet.has(p.fn));
    if (newProblematic.length > 0) {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      admins = data ?? [];
    }

    let alerted = 0;
    let recovered = 0;
    let deduped = 0;

    // 4. Alertas
    for (const row of problematic) {
      if (alertedSet.has(row.fn)) {
        deduped++;
        continue;
      }

      // Amostras de erro pra enriquecer o contexto
      const { data: samples } = await supabase
        .from("ops_events")
        .select("message,created_at")
        .eq("fn", row.fn)
        .eq("level", "error")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3);

      const pct = Math.round(row.error_rate * 100);

      // Notification batch (push é automático via trigger trg_push_on_notification)
      if (admins.length > 0) {
        const notifs = admins.map((a) => ({
          user_id: a.user_id,
          tipo: "sistema",
          categoria: "sla_urgente",
          titulo: `⚠️ Edge function instável: ${row.fn}`,
          mensagem:
            `${row.fn} teve ${row.error_calls}/${row.total_calls} erros nas ` +
            `últimas 24h (${pct}%). Abra /admin/ingestao para investigar.`,
          dados: {
            function_alerted: row.fn,
            error_rate: row.error_rate,
            total_calls: row.total_calls,
            error_calls: row.error_calls,
            detected_at: new Date().toISOString(),
            link: "/admin/ingestao",
          },
          lida: false,
        }));
        await supabase.from("notifications").insert(notifs);
      }

      // Log do alerta (alimenta dedup + card "Alertas Ativos")
      await supabase.from("ops_events").insert({
        fn: "edge-health-alert",
        level: "error",
        category: "alert",
        message: `Function ${row.fn} above error threshold (${pct}%)`,
        ctx: {
          function_alerted: row.fn,
          error_rate: row.error_rate,
          total_calls: row.total_calls,
          error_calls: row.error_calls,
          admins_notified: admins.length,
          samples: samples ?? [],
        },
      });

      alerted++;
    }

    // 5. Recovery silencioso (só registra, sem notification)
    for (const row of healthy) {
      if (!alertedSet.has(row.fn)) continue;
      await supabase.from("ops_events").insert({
        fn: "edge-health-alert",
        level: "info",
        category: "business",
        message: `edge-health-recovered: ${row.fn}`,
        ctx: {
          function_recovered: row.fn,
          error_rate: row.error_rate,
          total_calls: row.total_calls,
        },
      });
      recovered++;
    }

    const result = {
      checked: stats.length,
      alerted,
      recovered,
      deduped,
      problematic_now: problematic.map((p) => ({
        fn: p.fn,
        error_rate: p.error_rate,
        total_calls: p.total_calls,
      })),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[edge-health-alert] error", msg);
    await supabase.from("ops_events").insert({
      fn: "edge-health-alert",
      level: "error",
      category: "system",
      message: `edge-health-alert run failed: ${msg}`,
      ctx: { error: msg },
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
