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
const MAX_CUTUCOES = 5;
const STALL_HOURS = 4;     // silêncio mínimo do lead antes do 1º cutucão
const SPACING_HOURS = 44;  // intervalo entre um cutucão e o próximo (~2 dias, como o material)
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

// Templates OFICIAIS do WhatsApp (passam mesmo depois das 24h). key -> nome/idioma/doc do cabeçalho.
const WA_TEMPLATES: Record<string, { name: string; lang: string; headerDoc?: { link: string; filename: string } }> = {
  followup_casatuacanoaslia: {
    name: "followup_casatuacanoaslia",
    lang: "pt_BR",
    headerDoc: { link: `${MEDIA_BASE}/guia-casa-tua-santos-ferreira.pdf`, filename: "Guia Casa Tua Santos Ferreira.pdf" },
  },
};

// Envia um template APROVADO do WhatsApp (reativação pós-24h). {{1}} = primeiro nome do lead.
async function sendTemplate(to: string, tpl: { name: string; lang: string; headerDoc?: { link: string; filename: string } }, nome: string): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return { ok: false, err: "sem D360_API_KEY" };
  const components: any[] = [];
  if (tpl.headerDoc) components.push({ type: "header", parameters: [{ type: "document", document: { link: tpl.headerDoc.link, filename: tpl.headerDoc.filename } }] });
  components.push({ type: "body", parameters: [{ type: "text", text: (nome || "você").slice(0, 60) }] });
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: tpl.name, language: { code: tpl.lang }, components } }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); console.error("[lia-followup] template falhou", r.status, t); return { ok: false, err: `${r.status} ${t}`.slice(0, 260) }; }
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e).slice(0, 260) }; }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = svc();
    const body = await req.json().catch(() => ({}));
    // envio direcionado e imediato de um cutucão já APROVADO (ex.: lead esperando resposta agora).
    // Ignora o horário comercial e manda só pro telefone pedido; não roda detect/backfill.
    if (body?.soTelefone) {
      const enviados = await disparar(sb, { soTelefone: String(body.soTelefone), ignorarHorario: body.agora === true });
      return new Response(JSON.stringify({ ok: true, enviados, alvo: body.soTelefone }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
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
  // Só quem REALMENTE está sem resumo, e os mais recentes primeiro.
  // (antes o filtro do fallback era feito em JS depois de um limit(15) sem ordem,
  //  então lead novo podia nunca entrar na janela.)
  const { data: pend, error: errPend } = await sb
    .from("lia_estado")
    .select("telefone, lead_id, resumo, qualificado_em, agendou_em")
    .eq("status", "qualificado")
    .not("lead_id", "is", null)
    .or("resumo.is.null,resumo.like.Resumo automático indisponível%")
    .order("qualificado_em", { ascending: false })
    .limit(10);
  if (errPend) console.error("[lia-followup] backfill select falhou", errPend);
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
    // duas tentativas espaçadas: a 1ª pode pegar rate limit do gateway.
    let resumo = "";
    for (let t = 0; t < 2 && !resumo; t++) {
      if (t) await new Promise((res) => setTimeout(res, 4000));
      try {
        const rr = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
          body: JSON.stringify({ messages: msgs, mode: "resumo" }),
        });
        if (!rr.ok) { console.error("[lia-followup] resumo HTTP", rr.status, await rr.text().catch(() => "")); continue; }
        const d = await rr.json();
        resumo = String(d?.resumo ?? "").trim();
        if (!resumo) console.error("[lia-followup] resumo veio vazio para", e.telefone);
      } catch (err) { console.error("[lia-followup] resumo erro de rede", e.telefone, err); }
    }
    if (!resumo) continue;
    // o resumo é a fonte da flag "agendou": se ele nasceu quebrado, a preferência
    // de dia/turno que o lead deu ficou invisível no painel. Ao refazer o resumo,
    // reprocessa a flag também.
    const mAg = resumo.match(/Agendamento:\s*(.+)/i);
    const valAg = (mAg?.[1] ?? "").split("\n")[0].trim();
    const agendou = !!valAg && !/n[ãa]o\s+agend|n[ãa]o\s+inform|sem\s+agend|nenhum/i.test(valAg);
    const patch: Record<string, unknown> = { resumo };
    if (agendou) {
      patch.agendou = true;
      patch.agendamento = valAg.slice(0, 120);
      if (!e.agendou_em) patch.agendou_em = new Date().toISOString();
    }
    await sb.from("lia_estado").update(patch).eq("telefone", e.telefone);
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
    .in("status", ["novo", "em_conversa"]) // qualificado NÃO recebe cutucão: já é do corretor
    .eq("optout", false)
    .lt("followup_count", MAX_CUTUCOES)
    .lt("last_user_at", stallCut)
    .limit(200);
  if (!cands?.length) return 0;

  // quem já foi REPASSADO (tem corretor no caso) sai do follow-up: o humano assumiu.
  const leadIds = [...new Set(cands.map((c: any) => c.lead_id).filter(Boolean))];
  const repassados = new Set<string>();
  if (leadIds.length) {
    const { data: pls } = await sb
      .from("pipeline_leads").select("id, corretor_id, aceite_status")
      .in("id", leadIds);
    for (const pl of pls ?? [])
      if (pl.corretor_id && pl.aceite_status === "aceito") repassados.add(pl.id);
  }

  // templates ativos
  const { data: tpls } = await sb.from("lia_templates").select("*").eq("ativo", true);
  const T: Record<string, any> = {};
  for (const t of tpls ?? []) T[t.key] = t;

  let criados = 0;
  for (const c of cands) {
    if (!c.last_user_at) continue;
    if (c.lead_id && repassados.has(c.lead_id)) continue; // já tem corretor: humano assumiu
    // espaçamento: se já cutucou, espera SPACING_HOURS desde a última mensagem enviada
    if (c.followup_count > 0 && c.last_msg_em && (agora - new Date(c.last_msg_em).getTime()) < SPACING_HOURS * 3600_000) continue;

    // não empilha: já existe um cutucão pendente/aprovado pra esse telefone?
    const { data: aberto } = await sb
      .from("lia_followups").select("id").eq("telefone", c.telefone).in("status", ["pendente", "aprovado"]).limit(1);
    if (aberto && aberto.length) continue;

    const dentro24h = (agora - new Date(c.last_user_at).getTime()) < 24 * 3600_000;
    // Cadência dos 5 toques (playbook do time). Pós-24h só o TEMPLATE oficial passa;
    // dentro de 24h, texto livre escalando pelo número do toque (followup_count).
    const n = c.followup_count ?? 0; // 0 = primeiro toque
    let key: string;
    if (!dentro24h) {
      key = "followup_casatuacanoaslia";       // "Procura-se" + ebook (humor/spoiler, único pós-24h)
    } else if (n === 0) {
      key = c.status === "novo" ? "primeiro_retorno" : "sumiu_planta"; // 1º toque: spoiler/foto
    } else if (n === 1) {
      key = "novidade_estande";                // 2º toque: novidade (lista do estande)
    } else if (n === 2) {
      key = "condicao_pagamento";              // 3º toque: condição de pagamento
    } else {
      key = "porta_aberta";                    // 4º+ toque: porta aberta (responde 1/2/3)
    }
    const tpl = T[key];
    if (!tpl) continue;

    // só usa o nome se for um nome de verdade (WhatsApp às vezes manda só um emoji)
    const bruto = primeiroNome(c.nome);
    const nome = /\p{L}/u.test(bruto) ? bruto.replace(/[^\p{L}\p{M}'.-]/gu, "").trim() : "";
    const mensagem = String(tpl.corpo)
      .replaceAll("Oi {nome}, ", nome ? `Oi ${nome}, ` : "Oi! ")
      .replaceAll("{nome}", nome)
      .replace(/\s{2,}/g, " ").trim();
    const MOTIVOS: Record<string, string> = {
      followup_casatuacanoaslia: "Sumiu (passou de 24h), reativação",
      primeiro_retorno: "1º toque: só abriu e sumiu",
      sumiu_planta: "1º toque: esfriou depois de engajar",
      novidade_estande: "2º toque: novidade do estande",
      condicao_pagamento: "3º toque: condição de pagamento",
      porta_aberta: "4º toque: porta aberta",
    };
    const motivo = MOTIVOS[key] ?? "Follow-up";

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

/** Dispara os cutucões APROVADOS pelo Lucas, em horário comercial.
 * opts.ignorarHorario: envia mesmo fora da janela (só no envio direcionado).
 * opts.soTelefone: envia só pra este número. */
async function disparar(sb: any, opts: { ignorarHorario?: boolean; soTelefone?: string } = {}): Promise<number> {
  const h = horaBRT();
  if (!opts.ignorarHorario && (h < HORA_INI || h >= HORA_FIM)) return 0; // fora da janela: tenta na próxima rodada

  let q = sb
    .from("lia_followups")
    .select("*")
    .eq("status", "aprovado")
    .or(`agendado_para.is.null,agendado_para.lte.${nowISO()}`)
    .limit(50);
  if (opts.soTelefone) q = q.eq("telefone", opts.soTelefone);
  const { data: aprovados } = await q;
  if (!aprovados?.length) return 0;

  let enviados = 0;
  for (const f of aprovados) {
    // revalida o estado do lead (pode ter saído/qualificado no meio-tempo)
    const { data: estRows } = await sb.from("lia_estado").select("optout, followup_count, last_user_at, nome, status").eq("telefone", f.telefone).limit(1);
    const est = estRows?.[0];
    if (est?.optout || (est?.followup_count ?? 0) >= MAX_CUTUCOES) {
      await sb.from("lia_followups").update({ status: "cancelado", updated_at: nowISO() }).eq("id", f.id);
      continue;
    }
    // se o lead qualificou entre o rascunho e o envio, o corretor assume: não cutuca
    if (est?.status === "qualificado") {
      await sb.from("lia_followups").update({ status: "cancelado", motivo: `${f.motivo ?? ""} · lead já qualificado`.trim(), updated_at: nowISO() }).eq("id", f.id);
      continue;
    }
    // template oficial do WhatsApp passa mesmo pós-24h; cutucão livre (texto/foto) só vale até 24h.
    const ehTemplate = !!WA_TEMPLATES[f.template_key];
    if (!ehTemplate) {
      const ultimaFala = est?.last_user_at ? new Date(est.last_user_at).getTime() : 0;
      if (!ultimaFala || (Date.now() - ultimaFala) > 24 * 3600_000) {
        await sb.from("lia_followups").update({
          status: "cancelado",
          motivo: `${f.motivo ?? ""} · janela 24h fechada (precisa de template aprovado)`.trim(),
          updated_at: nowISO(),
        }).eq("id", f.id);
        continue;
      }
    }
    // se um corretor assumiu o caso no meio-tempo, não cutuca (humano assumiu)
    if (f.lead_id) {
      const { data: plRows } = await sb.from("pipeline_leads").select("corretor_id, aceite_status").eq("id", f.lead_id).limit(1);
      const pl = plRows?.[0];
      if (pl?.corretor_id && pl.aceite_status === "aceito") {
        await sb.from("lia_followups").update({ status: "cancelado", updated_at: nowISO() }).eq("id", f.id);
        continue;
      }
    }

    // nome limpo pro corpo do template (WhatsApp às vezes manda só emoji)
    const bruto = primeiroNome(est?.nome ?? "");
    const nomeLead = /\p{L}/u.test(bruto) ? bruto.replace(/[^\p{L}\p{M}'.-]/gu, "").trim() : "";
    let ok = false;
    if (ehTemplate) {
      const res = await sendTemplate(f.telefone, WA_TEMPLATES[f.template_key], nomeLead);
      ok = res.ok;
      if (!res.ok && res.err) await sb.from("lia_followups").update({ motivo: `ERRO TEMPLATE: ${res.err}`, updated_at: nowISO() }).eq("id", f.id);
    } else {
      ok = await send360Text(f.telefone, f.mensagem);
    }
    if (!ok) continue;
    await sb.from("lia_conversas").insert({ telefone: f.telefone, role: "assistant", conteudo: f.mensagem });

    // 1º toque (spoiler da obra): entrega valor com 2 fotos e fecha com uma pergunta leve (nada de
    // cobrança). Vale pra quem "abriu e sumiu" (primeiro_retorno) e pra quem engajou e esfriou (sumiu_planta).
    if (!ehTemplate && (f.template_key === "primeiro_retorno" || f.template_key === "sumiu_planta")) {
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
