// Fila de reenvio — reprocessa disparos que falharam.
// Fonte primária: reengajamento_meta_disparos com status "failed" (falha de entrega reportada
// pela Meta via webhook). Para cada falha, reabre o item correspondente na fila de disparo
// (volta para "pending"), marca a falha como "retried", reabre a execução e reinvoca o
// disparador em modo manual (bypass do gate global). Aciona apenas manualmente (usuário logado).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const last8 = (raw: string | null | undefined): string => {
  const d = (raw || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
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
    const metaIds: string[] = Array.isArray(body?.meta_ids)
      ? body.meta_ids.map((v: unknown) => String(v)).filter(Boolean)
      : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Seleciona as falhas de entrega a reprocessar ---
    let sel = supabase
      .from("reengajamento_meta_disparos")
      .select("id, lead_id, run_id, phone")
      .eq("status", "failed")
      .not("run_id", "is", null);
    if (metaIds.length > 0) sel = sel.in("id", metaIds);

    const { data: fails, error: selErr } = await sel.limit(500);
    if (selErr) return json({ error: selErr.message }, 500);
    if (!fails || fails.length === 0) {
      return json({ ok: true, reset: 0, runs: 0, reason: "no_failed_items" });
    }

    // --- Reabre os itens de fila correspondentes (volta para "pending") ---
    const affectedRuns = new Set<string>();
    const retriedMetaIds: string[] = [];
    let reset = 0;

    for (const f of fails) {
      const runId = f.run_id as string;
      if (!runId) continue;

      // Localiza o item na fila por run + lead (fallback: últimos 8 dígitos do telefone).
      let match = supabase
        .from("reengajamento_dispatch_queue")
        .update({ status: "pending", locked_at: null, error_text: null, processed_at: null, wamid: null })
        .eq("run_id", runId)
        .in("status", ["sent", "failed"]);
      match = f.lead_id
        ? match.eq("lead_id", f.lead_id)
        : match.eq("phone_last8", last8(f.phone));

      const { data: updated, error: updErr } = await match.select("id");
      if (updErr) continue;
      if (updated && updated.length > 0) {
        reset += updated.length;
        affectedRuns.add(runId);
        retriedMetaIds.push(f.id as string);
      }
    }

    if (reset === 0) {
      return json({ ok: true, reset: 0, runs: 0, reason: "no_matching_queue_items" });
    }

    // --- Marca as falhas reprocessadas para saírem da fila de reenvio ---
    if (retriedMetaIds.length > 0) {
      await supabase
        .from("reengajamento_meta_disparos")
        .update({ status: "retried" })
        .in("id", retriedMetaIds);
    }

    // --- Libera a pausa (ação manual explícita do usuário) ---
    const { data: cfg } = await supabase
      .from("reengajamento_config")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (cfg?.id) {
      await supabase.from("reengajamento_config").update({ paused: false }).eq("id", cfg.id);
    }

    // --- Reabre as execuções afetadas e reinvoca o disparador (manual) por run ---
    const runIds = Array.from(affectedRuns);
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

      // Fire-and-forget: o disparador continua a fila pendente deste run com o template original.
      supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, run_id: rId, iniciado_por: "manual_retry" },
      });
    }

    return json({ ok: true, reset, runs: runIds.length, run_ids: runIds });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
