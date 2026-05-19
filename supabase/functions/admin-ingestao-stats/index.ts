// Edge function: admin-ingestao-stats
// Lê function_edge_logs (analytics) e devolve p95 latência + contagem 503 por função.
// Apenas admins (validação manual de JWT + role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const RECEIVE_FNS = [
  "receive-meta-lead",
  "receive-imovelweb-lead",
  "receive-rdstation-lead",
  "receive-tiktok-lead",
  "receive-landing-lead",
  "crm-webhook",
  "distribute-lead",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── 1. Auth manual (verify_jwt=false na config) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse período ──
    const body = await req.json().catch(() => ({}));
    const hours = [24, 168, 720].includes(body.hours) ? body.hours : 24;

    // ── 3. Query function_edge_logs (Supabase Analytics via REST) ──
    // O endpoint /platform/projects/{ref}/analytics/endpoints/logs.all está disponível só via dashboard.
    // Alternativa: usar pg_net pra Logflare se configurado; senão devolver estrutura vazia + flag.
    // Para o painel funcional sem dependência externa, devolvemos counts de erros via ops_events
    // como proxy de saúde (já temos error rate ali). Latência p95 fica como "n/d" até integração Logflare.
    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: errEvents } = await admin
      .from("ops_events")
      .select("fn, error_detail, ctx")
      .gte("created_at", sinceIso)
      .in("fn", RECEIVE_FNS)
      .eq("level", "error");

    // Heurística: 503 = error_detail contém '503' ou ctx->>'status'='503'
    const counts503: Record<string, number> = {};
    for (const fn of RECEIVE_FNS) counts503[fn] = 0;
    for (const ev of errEvents ?? []) {
      const hay = `${ev.error_detail ?? ""} ${JSON.stringify(ev.ctx ?? {})}`;
      if (hay.includes("503")) counts503[ev.fn] = (counts503[ev.fn] ?? 0) + 1;
    }

    return new Response(
      JSON.stringify({
        hours,
        counts_503: counts503,
        total_503: Object.values(counts503).reduce((a, b) => a + b, 0),
        p95_latency_ms: null, // requer integração Logflare/Analytics; n/d por enquanto
        note: "p95 não disponível sem integração com Logflare/Supabase Analytics API",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("admin-ingestao-stats error", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
