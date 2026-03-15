import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth: Bearer token must match UHOME_AI_SECRET ──
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const secret = Deno.env.get("UHOME_AI_SECRET");

  if (!secret || token !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Parse & validate body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const {
    lead_id,
    status,
    resumo,
    finalidade,
    regiao_interesse,
    faixa_investimento,
    prazo_compra,
    proxima_acao,
    prioridade,
  } = body as Record<string, string>;

  // Required fields
  if (!lead_id || !status || !resumo || !proxima_acao || !prioridade) {
    return json(
      { error: "Missing required fields: lead_id, status, resumo, proxima_acao, prioridade" },
      400,
    );
  }

  if (!UUID_RE.test(lead_id)) {
    return json({ error: "Invalid lead_id format" }, 400);
  }

  // ── Supabase service-role client (bypasses RLS) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── 1. Validate lead exists ──
  const { data: lead, error: leadErr } = await supabase
    .from("pipeline_leads")
    .select("id")
    .eq("id", lead_id)
    .maybeSingle();

  if (leadErr) {
    console.error("Lead lookup error:", leadErr);
    return json({ error: "Internal error looking up lead" }, 500);
  }

  if (!lead) {
    return json({ error: "Lead not found" }, 404);
  }

  // ── 2. Update pipeline_leads with call result data ──
  const updatePayload: Record<string, unknown> = {
    observacoes: resumo,
    proxima_acao,
    prioridade_lead: prioridade,
    ultima_acao_at: new Date().toISOString(),
  };

  if (regiao_interesse) updatePayload.bairro_regiao = regiao_interesse;
  if (finalidade) updatePayload.objetivo_cliente = finalidade;

  const { error: updateErr } = await supabase
    .from("pipeline_leads")
    .update(updatePayload)
    .eq("id", lead_id);

  if (updateErr) {
    console.error("Lead update error:", updateErr);
    return json({ error: "Failed to update lead" }, 500);
  }

  // ── 3. Insert activity log row ──
  const { error: logErr } = await supabase.from("ia_call_results").insert({
    lead_id,
    status,
    resumo,
    finalidade: finalidade ?? null,
    regiao_interesse: regiao_interesse ?? null,
    faixa_investimento: faixa_investimento ?? null,
    prazo_compra: prazo_compra ?? null,
    proxima_acao,
    prioridade,
  });

  if (logErr) {
    console.error("Activity log insert error:", logErr);
    return json({ error: "Lead updated but failed to log activity" }, 500);
  }

  return json({ success: true, lead_id });
});
