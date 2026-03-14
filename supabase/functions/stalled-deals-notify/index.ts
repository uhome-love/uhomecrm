import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "stalled-deals-notify";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = req.headers.get("x-trace-id") || `t-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
  const L = makeLogger(traceId);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const logOps = (level: string, category: string, message: string, ctx?: Record<string, unknown>, errorDetail?: string) => {
      supabase.from("ops_events").insert({ fn: FN, level, category, message, trace_id: traceId, ctx: ctx || {}, error_detail: errorDetail || null }).then(r => { if (r.error) console.warn("ops_events insert err:", r.error.message); });
    };

    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Get stalled deals (15+ days without stage change)
    const { data: stalledDeals, error: fetchErr } = await supabase
      .from("pipeline_leads")
      .select("id, nome, empreendimento, stage_changed_at, gerente_id")
      .lt("stage_changed_at", fifteenDaysAgo)
      .order("stage_changed_at", { ascending: true });

    if (fetchErr) {
      L.error("Failed to fetch stalled deals", {}, fetchErr);
      logOps("error", "system", "Failed to fetch stalled deals", {}, fetchErr.message);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!stalledDeals || stalledDeals.length === 0) {
      L.info("No stalled deals found");
      return new Response(JSON.stringify({ message: "No stalled deals" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group by gerente
    const byGerente = new Map<string, typeof stalledDeals>();
    for (const deal of stalledDeals) {
      if (!deal.gerente_id) continue;
      const list = byGerente.get(deal.gerente_id) || [];
      list.push(deal);
      byGerente.set(deal.gerente_id, list);
    }

    let notificationsCreated = 0;

    for (const [gerenteId, deals] of byGerente) {
      const top5 = deals.slice(0, 5);
      const listText = top5.map(d => `• ${d.nome}${d.empreendimento ? ` (${d.empreendimento})` : ""}`).join("\n");
      const extra = deals.length > 5 ? `\n... e mais ${deals.length - 5} negócios` : "";

      await supabase.from("notifications").insert({
        user_id: gerenteId,
        titulo: "🚨 Negócios parados há 15+ dias",
        mensagem: `${deals.length} negócios parados há mais de 15 dias precisam de ação.\n\n${listText}${extra}`,
        tipo: "negocios_parados",
        categoria: "pipeline",
        dados: { deal_ids: top5.map(d => d.id), total: deals.length },
      });
      notificationsCreated++;
    }

    const result = { notificationsCreated, totalStalled: stalledDeals.length, gerentes: byGerente.size };
    L.info("Run complete", result as unknown as Record<string, unknown>);
    if (notificationsCreated > 0) {
      logOps("info", "business", `Stalled deals: ${notificationsCreated} gerentes notified, ${stalledDeals.length} deals total`, result as unknown as Record<string, unknown>);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    L.error("Unhandled exception", {}, error);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      sb.from("ops_events").insert({ fn: FN, level: "error", category: "system", message: "Unhandled exception", trace_id: traceId, ctx: {}, error_detail: error instanceof Error ? error.message : String(error) }).then(() => {});
    } catch {}
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
