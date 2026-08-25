/**
 * lia-reengajar-arm — arma um LOTE (run) de reengajamento.
 *
 * Recebe o filtro escolhido no hub (balde, modo produto/cardapio, produto_slug, template,
 * cap/dia, tamanho do lote), cria um run com status 'armado' e POPULA a fila a partir da
 * view lia_reengajamento_elegiveis (fonte única: já deduplicada, sem bloqueados, sem lead vivo).
 *
 * NÃO dispara nada. O envio só acontece quando o run vira 'ativo' (botão Iniciar no hub)
 * E a flag system_flags.lia_reengajamento_enabled está ligada. Chamado pelo hub (autenticado).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const svc = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const nowISO = () => new Date().toISOString();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const nome = typeof body.nome === "string" ? body.nome : null;
    const modo = body.modo === "cardapio" ? "cardapio" : "produto";
    const produto_slug = typeof body.produto_slug === "string" ? body.produto_slug : null;
    const template_key = typeof body.template_key === "string" ? body.template_key : null;
    const balde = typeof body.balde === "string" ? body.balde : null;
    const cap_dia = Number.isFinite(Number(body.cap_dia)) ? Math.max(1, Math.min(500, Number(body.cap_dia))) : 30;
    const lote = Number.isFinite(Number(body.lote)) ? Math.max(1, Math.min(500, Number(body.lote))) : 100;

    if (!template_key) return new Response(JSON.stringify({ ok: false, error: "template_key obrigatório" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    if (modo === "produto" && !produto_slug) return new Response(JSON.stringify({ ok: false, error: "produto_slug obrigatório no modo produto" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = svc();

    // seleção a partir da view (fonte única)
    let q = sb.from("lia_reengajamento_elegiveis").select("pipeline_lead_id, nome, telefone, tel8, produto_slug, balde");
    if (modo === "produto") q = q.eq("produto_slug", produto_slug);
    else q = q.is("produto_slug", null); // cardápio: órfãos + produto morto
    if (balde) q = q.eq("balde", balde);
    q = q.limit(lote);
    const { data: elegiveis, error } = await q;
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    if (!elegiveis?.length) return new Response(JSON.stringify({ ok: true, run_id: null, lote_total: 0, msg: "nenhum elegível pro filtro" }), { headers: { ...cors, "Content-Type": "application/json" } });

    // cria o run (armado, não dispara)
    const { data: run, error: e2 } = await sb.from("lia_reengajamento_runs").insert({
      nome: nome ?? `Reengajar ${balde ?? ""} · ${modo === "produto" ? produto_slug : "cardápio"}`.trim(),
      modo,
      produto_slug: modo === "produto" ? produto_slug : null,
      template_key,
      filtro: { balde, produto_slug, modo },
      cap_dia,
      status: "armado",
    }).select("id").single();
    if (e2 || !run) return new Response(JSON.stringify({ ok: false, error: e2?.message ?? "falha ao criar run" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

    // popula a fila
    const rows = elegiveis.map((el: any) => ({
      run_id: run.id,
      pipeline_lead_id: el.pipeline_lead_id,
      telefone: el.telefone,
      tel8: el.tel8,
      nome: el.nome,
      produto_slug: modo === "produto" ? produto_slug : el.produto_slug,
      balde: el.balde,
      template_key,
      status: "pendente",
    }));
    const { error: e3 } = await sb.from("lia_reengajamento_fila").insert(rows);
    if (e3) console.error("[lia-reengajar-arm] insert fila falhou", e3);
    await sb.from("lia_reengajamento_runs").update({ lote_total: rows.length, updated_at: nowISO() }).eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, run_id: run.id, lote_total: rows.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[lia-reengajar-arm] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
