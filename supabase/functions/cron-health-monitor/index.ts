import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const startedAt = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("v_cron_health_summary")
      .select("*")
      .gte("recent_errors", 3);

    if (error) throw error;

    const alerts = data ?? [];

    // Also detect "silent" crons: nothing logged in last 30 min for known crons
    const knownCrons = [
      "lead-escalation",
      "cron-nurturing-sequencer",
      "oferta-ativa-distribute",
      "roleta-redistribuicao",
    ];
    const silentCrons: string[] = [];
    for (const name of knownCrons) {
      const { data: last } = await supabase
        .from("cron_health")
        .select("started_at")
        .eq("cron_name", name)
        .order("started_at", { ascending: false })
        .limit(1);
      const lastRun = last?.[0]?.started_at;
      if (!lastRun || Date.now() - new Date(lastRun).getTime() > 30 * 60 * 1000) {
        silentCrons.push(name);
      }
    }

    const payload = { alerts, silentCrons, checkedAt: startedAt };

    if (alerts.length > 0 || silentCrons.length > 0) {
      console.error("[cron-health-monitor] ALERT", JSON.stringify(payload));
    }

    await supabase.rpc("log_cron_run", {
      p_cron_name: "cron-health-monitor",
      p_status: "success",
      p_metadata: payload,
      p_started_at: startedAt,
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron-health-monitor] error", msg);
    await supabase.rpc("log_cron_run", {
      p_cron_name: "cron-health-monitor",
      p_status: "error",
      p_error: msg,
      p_started_at: startedAt,
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
