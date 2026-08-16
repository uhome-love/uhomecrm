/**
 * lia-followup — motor de follow-up (reengajamento) da LIA.
 *
 * Roda no cron. Faz duas coisas:
 *  1) RASCUNHA (DETECT): acha leads que engajaram e esfriaram, e cria em
 *     lia_followups um cutucão PENDENTE (montado do template certo), pro Lucas
 *     aprovar no hub. Respeita: máx 3 cutucões por lead, espaçamento, janela de
 *     24h (dentro = livre; fora = template aprovado), nunca opt-out/descartado.
 *  2) ENVIA (DISPATCH): pega os que o Lucas APROVOU e dispara pelo 360dialog,
 *     só em horário comercial (9h-20h BRT). Marca enviado e conta a tentativa.
 *
 * Nada dispara sem aprovação humana (status 'aprovado'). Público (verify_jwt=false),
 * chamado pelo pg_cron com Bearer anon, igual às outras crons do projeto.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const D360_URL = "https://waba-v2.360dialog.io/messages";
const EDGE_BASE = "https://hunbxqzhvuemgntklyzb.supabase.co";
const MEDIA_BASE = "https://uhomesales.com/casatua";
const FOTO_FACHADA = `${MEDIA_BASE}/casa.jpg`;   // fachada das casas (sobrados ao entardecer)
const FOTO_INFRA = `${MEDIA_BASE}/club.jpg`;      // infra do condomínio (piscina + club house)
const FECHO_ABRIU = "E aí, o que você achou? 😊"; // pergunta leve depois das fotos
const MAX_CUTUCOES = 3;
const STALL_HOURS = 4;     // silêncio mínimo do lead antes do 1º cutucão
const SPACING_HOURS = 20;  // intervalo entre um cutucão e o próximo
const HORA_INI = 9;        // janela de envio (BRT)
const HORA_FIM = 20;

const svc = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const nowISO = () => new Date().toISOString();
const primeiroNome = (n: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const horaBRT = () => {
  const s = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit" });
  return parseInt(s, 10);
};

async function send360Text(to: string, body: string) {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) { console.error("[lia-followup] D360_API_KEY ausente"); return false; }
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    if (!r.ok) { console.error("[lia-followup] 360dialog falhou", r.status, await r.text().catch(() => "")); return false; }
    return true;
  } catch (e) { console.error("[lia-followup] erro no send", e); return false; }
}

async function send360Image(to: string, link: string) {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return false;
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "image", image: { link } }),
    });
    if (!r.ok) { console.error("[lia-followup] imagem falhou", r.status, await r.text().catch(() => "")); return false; }
    return true;
  } catch (e) { console.error("[lia-followup] erro na imagem", e); return false; }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = svc();
    const resumos = await backfillResumos(sb);
    const rascunhados = await detectar(sb);
    const enviados = await disparar(sb);
    return new Response(JSON.stringify({ ok: true, resumos, rascunhados, enviados }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[lia-followup] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

/** Rede de segurança: gera por IA o resumo dos leads qualificados que ficaram sem resumo real
 * (null ou no fallback). Roda espaçado no cron, sem competir com a resposta do webhook. */
async function backfillResumos(sb: any): Promise<number> {
  const { data: pend } = await sb
    .from("lia_estado")
    .select("telefone, lead_id, resumo")
    .eq("status", "qualificado")
    .not("lead_id", "is", null)
    .limit(15);
  if (!pend?.length) return 0;
  let n = 0;
  for (const e of pend) {
    const r = String(e.resumo ?? "");
    if (r.trim() && !r.startsWith("Resumo automático indisponível")) continue;
    const { data: hist } = await sb
      .from("lia_conversas").select("role, conteudo")
      .eq("telefone", e.telefone).order("created_at", { ascending: true }).limit(60);
    const msgs = (hist ?? []).map((h: any) => ({ role: h.role, content: h.conteudo }));
    if (!msgs.length) continue;
    let resumo = "";
    try {
      const rr = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
        body: JSON.stringify({ messages: msgs, mode: "resumo" }),
      });
      const d = await rr.json();
      resumo = String(d?.resumo ?? "").trim();
    } catch (_e) { /* tenta na próxima rodada */ }
    if (!resumo) continue;
    await sb.from("lia_estado").update({ resumo }).eq("telefone", e.telefone);
    await sb.from("pipeline_atividades").update({ descricao: resumo })
      .eq("pipeline_lead_id", e.lead_id).eq("tipo", "entrada");
    n++;
    await new Promise((res) => setTimeout(res, 1500)); // espaça entre leads
  }
  return n;
}

/** Acha leads esfriados e cria cutucões PENDENTES (pro Lucas aprovar). */
async function detectar(sb: any): Promise<number> {
  const agora = Date.now();
  const stallCut = new Date(agora - STALL_HOURS * 3600_000).toISOString();

  // candidatos: engajaram (em_conversa/qualificado), não saíram, ainda têm cota de cutucão
  const { data: cands } = await sb
    .from("lia_estado")
    .select("telefone, nome, lead_id, status, last_user_at, last_msg_em, followup_count")
    .in("status", ["novo", "em_conversa", "qualificado"])
    .eq("optout", false)
    .lt("followup_count", MAX_CUTUCOES)
    .lt("last_user_at", stallCut)
    .limit(200);
  if (!cands?.length) return 0;

  // templates ativos
  const { data: tpls } = await sb.from("lia_templates").select("*").eq("ativo", true);
  const T: Record<string, any> = {};
  for (const t of tpls ?? []) T[t.key] = t;

  let criados = 0;
  for (const c of cands) {
    if (!c.last_user_at) continue;
    // espaçamento: se já cutucou, espera SPACING_HOURS desde a última mensagem enviada
    if (c.followup_count > 0 && c.last_msg_em && (agora - new Date(c.last_msg_em).getTime()) < SPACING_HOURS * 3600_000) continue;

    // não empilha: já existe um cutucão pendente/aprovado pra esse telefone?
    const { data: aberto } = await sb
      .from("lia_followups").select("id").eq("telefone", c.telefone).in("status", ["pendente", "aprovado"]).limit(1);
    if (aberto && aberto.length) continue;

    const dentro24h = (agora - new Date(c.last_user_at).getTime()) < 24 * 3600_000;
    const key = !dentro24h ? "reativacao" : (c.status === "novo" ? "primeiro_retorno" : c.status === "qualificado" ? "sem_horario" : "sumiu_planta");
    const tpl = T[key];
    if (!tpl) continue;

    // só usa o nome se for um nome de verdade (WhatsApp às vezes manda só um emoji)
    const bruto = primeiroNome(c.nome);
    const nome = /\p{L}/u.test(bruto) ? bruto.replace(/[^\p{L}\p{M}'.-]/gu, "").trim() : "";
    const mensagem = String(tpl.corpo)
      .replaceAll("Oi {nome}, ", nome ? `Oi ${nome}, ` : "Oi! ")
      .replaceAll("{nome}", nome)
      .replace(/\s{2,}/g, " ").trim();
    const motivo = !dentro24h ? "Frio, passou de 24h" : (c.status === "novo" ? "Só abriu, não respondeu" : c.status === "qualificado" ? "Engajou, não marcou horário" : "Esfriou depois de engajar");

    const { error } = await sb.from("lia_followups").insert({
      telefone: c.telefone,
      lead_id: c.lead_id,
      template_key: key,
      mensagem,
      motivo,
      dentro_24h: dentro24h,
      tentativa: (c.followup_count ?? 0) + 1,
      status: "pendente",
    });
    if (!error) criados++;
  }
  return criados;
}

/** Dispara os cutucões APROVADOS pelo Lucas, em horário comercial. */
async function disparar(sb: any): Promise<number> {
  const h = horaBRT();
  if (h < HORA_INI || h >= HORA_FIM) return 0; // fora da janela: tenta na próxima rodada

  const { data: aprovados } = await sb
    .from("lia_followups")
    .select("*")
    .eq("status", "aprovado")
    .or(`agendado_para.is.null,agendado_para.lte.${nowISO()}`)
    .limit(50);
  if (!aprovados?.length) return 0;

  let enviados = 0;
  for (const f of aprovados) {
    // revalida o estado do lead (pode ter saído/qualificado no meio-tempo)
    const { data: estRows } = await sb.from("lia_estado").select("optout, followup_count").eq("telefone", f.telefone).limit(1);
    const est = estRows?.[0];
    if (est?.optout || (est?.followup_count ?? 0) >= MAX_CUTUCOES) {
      await sb.from("lia_followups").update({ status: "cancelado", updated_at: nowISO() }).eq("id", f.id);
      continue;
    }

    const ok = await send360Text(f.telefone, f.mensagem);
    if (!ok) continue;
    await sb.from("lia_conversas").insert({ telefone: f.telefone, role: "assistant", conteudo: f.mensagem });

    // "abriu e sumiu": entrega valor com 2 fotos e fecha com uma pergunta leve (nada de cobrança)
    if (f.template_key === "primeiro_retorno") {
      await sleep(1200); if (await send360Image(f.telefone, FOTO_FACHADA))
        await sb.from("lia_conversas").insert({ telefone: f.telefone, role: "assistant", conteudo: "[foto] Fachada das casas" });
      await sleep(1200); if (await send360Image(f.telefone, FOTO_INFRA))
        await sb.from("lia_conversas").insert({ telefone: f.telefone, role: "assistant", conteudo: "[foto] Infra do condomínio" });
      await sleep(1200); if (await send360Text(f.telefone, FECHO_ABRIU))
        await sb.from("lia_conversas").insert({ telefone: f.telefone, role: "assistant", conteudo: FECHO_ABRIU });
    }

    await sb.from("lia_followups").update({ status: "enviado", enviado_em: nowISO(), updated_at: nowISO() }).eq("id", f.id);
    await sb.from("lia_estado").update({
      followup_count: (est?.followup_count ?? 0) + 1,
      last_msg_em: nowISO(),
      updated_at: nowISO(),
    }).eq("telefone", f.telefone);
    enviados++;
  }
  return enviados;
}
