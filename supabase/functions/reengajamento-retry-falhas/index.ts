// Fila de reenvio — reprocessa itens da fila de disparo que ficaram com status "failed".
// Aciona apenas manualmente (usuário autenticado). Reseta os itens para "pending",
// reabre as execuções afetadas e reinvoca o disparador em modo manual (bypass do gate global).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- Autenticação: exige usuário logado ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    // --- Parse do body ---
    const body = await req.json().catch(() => ({}));
    const runId: string | null = body?.run_id ? String(body.run_id) : null;
    const queueIds: string[] = Array.isArray(body?.queue_ids)
      ? body.queue_ids.map((v: unknown) => String(v)).filter(Boolean)
      : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Seleciona os itens com falha a reprocessar ---
    let sel = supabase
      .from("reengajamento_dispatch_queue")
      .select("id, run_id")
      .eq("status", "failed");
    if (queueIds.length > 0) sel = sel.in("id", queueIds);
    else if (runId) sel = sel.eq("run_id", runId);

    const { data: failedItems, error: selErr } = await sel;
    if (selErr) return json({ error: selErr.message }, 500);
    if (!failedItems || failedItems.length === 0) {
      return json({ ok: true, reset: 0, runs: 0, reason: "no_failed_items" });
    }

    const ids = failedItems.map((i) => i.id);
    const runIds = Array.from(new Set(failedItems.map((i) => i.run_id).filter(Boolean))) as string[];

    // --- Reseta os itens para "pending" ---
    const { error: updErr } = await supabase
      .from("reengajamento_dispatch_queue")
      .update({ status: "pending", locked_at: null, error_text: null, processed_at: null })
      .in("id", ids);
    if (updErr) return json({ error: updErr.message }, 500);

    // --- Reabre as execuções afetadas e reinvoca o disparador (manual) por run ---
    for (const rId of runIds) {
      await supabase
        .from("reengajamento_dispatch_runs")
        .update({
          status: "running",
          finished_at: null,
          cancel_requested: false,
          motivo_parada: "Reprocessando falhas (reenvio manual)",
        })
        .eq("id", rId);

      // Fire-and-forget: o disparador continua a fila pendente deste run.
      supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, run_id: rId, iniciado_por: "manual_retry" },
      });
    }

    return json({ ok: true, reset: ids.length, runs: runIds.length, run_ids: runIds });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
