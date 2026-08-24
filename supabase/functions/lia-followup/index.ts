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
const MAX_CUTUCOES = 4;     // = tamanho da CADENCIA (4 toques de template aprovado)
const STALL_HOURS = 24;    // silêncio mínimo do lead antes do 1º cutucão (régua Lucas: 24h)
const SPACING_HOURS = 24;  // intervalo entre um cutucão e o próximo (régua Lucas: 24/48/72/96h)
const HORA_INI = 9;        // janela de envio (BRT)
const HORA_FIM = 20;
// LIA PROATIVA (cutucão inteligente): retoma uma conversa que ficou muda ainda DENTRO da janela do
// mesmo dia, com uma mensagem contextual (texto livre, permitido nas 24h desde a última fala do lead).
// Preenche o buraco antes da cadência de template (que só assume em 24h). Máx 1 por lead.
const REENG_MIN_H = 3;     // silêncio mínimo antes de cutucar
const REENG_MAX_H = 20;    // não cutuca depois disso (aí a cadência de template assume)
const REENG_JANELA_H = 23; // janela free-form do WhatsApp desde a última fala do LEAD
const REENG_MAX_POR_RODADA = 6; // teto por execução (cada um faz 1 chamada de IA)

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

// Templates OFICIAIS do WhatsApp APROVADOS (passam mesmo depois das 24h). key = nome do template
// no 360dialog. Todos são {{1}} = primeiro nome no corpo. Só o casatuacanoaslia tem cabeçalho (ebook).
// vars = nº de variáveis {{n}} no CORPO do template aprovado (os 4 de follow-up são texto genérico,
// SEM variável = 0; mandar 1 param dava erro #132000 "número de parâmetros não bate").
const WA_TEMPLATES: Record<string, { name: string; lang: string; vars?: number; headerDoc?: { link: string; filename: string } }> = {
  // {{1}} = primeiro nome, {{2}} = nome público do imóvel (mesma convenção do primeirocontato_lia).
  followup_novidade_lia:     { name: "followup_novidade_lia",     lang: "pt_BR", vars: 2 },
  followup_simulacao_lia:    { name: "followup_simulacao_lia",    lang: "pt_BR", vars: 2 },
  followup_procurase_lia:    { name: "followup_procurase_lia",    lang: "pt_BR", vars: 2 },
  followup_encerramento_lia: { name: "followup_encerramento_lia", lang: "pt_BR", vars: 2 },
  followup_casatuacanoaslia: {
    name: "followup_casatuacanoaslia",
    lang: "pt_BR",
    vars: 1,
    headerDoc: { link: `${MEDIA_BASE}/guia-casa-tua-santos-ferreira.pdf`, filename: "Guia Casa Tua Santos Ferreira.pdf" },
  },
};

// CADÊNCIA AUTOMÁTICA (os toques, na ordem). Cada item é um template aprovado.
// "__REATIVACAO__" = o template de reativação do PRODUTO do lead (Canoas = ebook; demais = procura-se).
// Ajustar a ordem/quantidade aqui muda toda a cadência. Rodada pós-24h: só template aprovado passa.
const CADENCIA: string[] = [
  "followup_novidade_lia",     // toque 1 — "lembrei de você"
  "followup_simulacao_lia",    // toque 2 — "posso te fazer uma simulação"
  "__REATIVACAO__",            // toque 3 — "procura-se" (do produto)
  "followup_encerramento_lia", // toque 4 — "encerrando por aqui, porta aberta"
];

// Envia um template APROVADO do WhatsApp (reativação pós-24h). {{1}} = primeiro nome do lead.
async function sendTemplate(to: string, tpl: { name: string; lang: string; vars?: number; headerDoc?: { link: string; filename: string } }, bodyParams: string[]): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return { ok: false, err: "sem D360_API_KEY" };
  const components: any[] = [];
  if (tpl.headerDoc) components.push({ type: "header", parameters: [{ type: "document", document: { link: tpl.headerDoc.link, filename: tpl.headerDoc.filename } }] });
  // manda EXATAMENTE `vars` parâmetros no corpo (o nº PRECISA bater com as variáveis do template,
  // senão #132000). Convenção LIA: {{1}}=primeiro nome, {{2}}=nome público do imóvel.
  const n = tpl.vars ?? 1;
  if (n >= 1) {
    const params = [];
    for (let i = 0; i < n; i++) params.push({ type: "text", text: (bodyParams[i] || "você").slice(0, 60) });
    components.push({ type: "body", parameters: params });
  }
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
    // A CADÊNCIA VEM PRIMEIRO e é blindada: o backfill de resumos faz chamadas de IA lentas
    // (até 10 leads × 2 tentativas × esperas), e se ele estoura o tempo da função o detectar/disparar
    // NUNCA rodavam (bug: cadência zerada desde 23/08). Agora cada etapa é isolada por try/catch e a
    // cadência roda antes, então um backfill lento nunca mais bloqueia o follow-up.
    let rascunhados = 0, enviados = 0, resumos = 0, reengajados = 0;
    try { rascunhados = await detectar(sb); } catch (e) { console.error("[lia-followup] detectar falhou", e); }
    try { enviados = await disparar(sb); } catch (e) { console.error("[lia-followup] disparar falhou", e); }
    // LIA proativa: cutucão inteligente dentro da janela do mesmo dia (roda depois da cadência, antes do backfill lento)
    try { reengajados = await reengajarProativo(sb); } catch (e) { console.error("[lia-followup] reengajar falhou", e); }
    try { resumos = await backfillResumos(sb); } catch (e) { console.error("[lia-followup] backfill falhou", e); }
    return new Response(JSON.stringify({ ok: true, rascunhados, enviados, reengajados, resumos }), { headers: { ...cors, "Content-Type": "application/json" } });
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

// Texto do toque pro LOG interno (lia_conversas/hub). A mensagem REAL enviada é o template
// aprovado no WhatsApp; isto é só a referência legível pro time. Aproximação do corpo do template.
// Espelha o CORPO real do template aprovado (só o log do hub; o envio é o template do WhatsApp
// com {{1}}=primeiro nome e {{2}}=imóvel preenchidos). "[nome]"/"[imóvel]" marcam as variáveis.
const RESUMO_TOQUE: Record<string, string> = {
  followup_novidade_lia:     "Olá [nome], lembrei de você, tem uma novidade no [imóvel] que combina com o que você procurava. Posso te contar rapidinho por aqui?",
  followup_simulacao_lia:    "Oi [nome]! Posso te fazer uma simulação rapidinha do [imóvel], sem compromisso, pra você ter uma noção?",
  followup_procurase_lia:    "🔍 Procura-se [nome]! Sumiu das minhas mensagens 😅 ainda quer ver o [imóvel]? Tenho novidades pra te mostrar.",
  followup_encerramento_lia: "[nome], vou parar de te chamar por aqui pra não incomodar, mas a porta segue aberta. Quando quiser saber do [imóvel], é só me dar um oi 🙂",
  followup_casatuacanoaslia: "🔍 Procura-se [nome]! Deixei o guia do [imóvel] aqui pra você.",
};

/** CADÊNCIA AUTOMÁTICA: acha leads que esfriaram (INCLUSIVE quem só recebeu o 1º contato e nunca
 *  respondeu) e agenda o próximo toque da CADENCIA — já como 'aprovado' (envio AUTOMÁTICO, sem trava
 *  manual). Multiproduto: o toque de reativação usa o template do PRODUTO do lead. */
async function detectar(sb: any): Promise<number> {
  const agora = Date.now();

  // candidatos: em conversa OU só receberam o 1º contato; não saíram; ainda têm cota de toque.
  // qualificado NÃO recebe toque (já é do corretor).
  const { data: cands } = await sb
    .from("lia_estado")
    .select("telefone, nome, lead_id, status, produto_slug, last_user_at, last_msg_em, followup_count")
    .in("status", ["novo", "em_conversa"])
    .eq("optout", false)
    .lt("followup_count", MAX_CUTUCOES)
    .limit(300);
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

  // template de reativação por produto (Canoas = ebook; demais = procura-se genérico).
  const { data: prods } = await sb.from("lia_produtos").select("slug, template_reativacao");
  const reativacaoPorProduto: Record<string, string> = {};
  for (const p of prods ?? []) if (p.template_reativacao) reativacaoPorProduto[p.slug] = p.template_reativacao;

  let criados = 0;
  for (const c of cands) {
    if (c.lead_id && repassados.has(c.lead_id)) continue; // já tem corretor: humano assumiu

    // relógio do silêncio: última fala do LEAD, ou (se nunca falou) a última mensagem que a LIA mandou.
    const relogio = c.last_user_at ? new Date(c.last_user_at).getTime()
                   : c.last_msg_em ? new Date(c.last_msg_em).getTime() : 0;
    if (!relogio) continue;
    const n = c.followup_count ?? 0; // 0 = ainda não cutucou

    // espera: 1º toque após STALL_HOURS de silêncio; toques seguintes após SPACING_HOURS da última msg.
    if (n === 0) {
      if (agora - relogio < STALL_HOURS * 3600_000) continue;
    } else {
      if (!c.last_msg_em || (agora - new Date(c.last_msg_em).getTime()) < SPACING_HOURS * 3600_000) continue;
    }

    // não empilha: já existe toque pendente/aprovado pra esse telefone?
    const { data: aberto } = await sb
      .from("lia_followups").select("id").eq("telefone", c.telefone).in("status", ["pendente", "aprovado"]).limit(1);
    if (aberto && aberto.length) continue;

    // toque atual da cadência (resolvendo o de reativação pro produto do lead)
    let key = CADENCIA[n];
    if (key === "__REATIVACAO__") key = reativacaoPorProduto[c.produto_slug ?? ""] ?? "followup_procurase_lia";
    if (!WA_TEMPLATES[key]) continue; // template não configurado → pula (segurança)

    const { error } = await sb.from("lia_followups").insert({
      telefone: c.telefone,
      lead_id: c.lead_id,
      template_key: key,
      mensagem: RESUMO_TOQUE[key] ?? `[${key}]`,
      motivo: `Toque ${n + 1}/${CADENCIA.length} · ${key}`,
      dentro_24h: false,
      tentativa: n + 1,
      status: "aprovado", // AUTO: sem trava manual — dispara na próxima rodada em horário comercial
    });
    if (!error) criados++;
  }
  return criados;
}

/** LIA PROATIVA (cutucão inteligente): retoma, com UMA mensagem contextual, conversas que ficaram
 * mudas ainda dentro da janela do mesmo dia (antes da cadência de template assumir em 24h). Texto
 * livre gerado pelo cérebro da LIA (modo reengajar), específico ao que o lead falou. Máx 1 por lead. */
async function reengajarProativo(sb: any): Promise<number> {
  const h = horaBRT();
  if (h < HORA_INI || h >= HORA_FIM) return 0; // só horário comercial
  const agora = Date.now();

  const { data: cands } = await sb
    .from("lia_estado")
    .select("telefone, nome, lead_id, status, produto_slug, last_user_at, last_msg_em, followup_count, reengajado_em, repassado_em")
    .in("status", ["novo", "em_conversa"])
    .eq("optout", false)
    .is("reengajado_em", null)
    .eq("followup_count", 0)
    .not("last_user_at", "is", null)
    .limit(200);
  if (!cands?.length) return 0;

  // quem já tem corretor (repassado) sai: o humano assumiu
  const leadIds = [...new Set(cands.map((c: any) => c.lead_id).filter(Boolean))];
  const repassados = new Set<string>();
  if (leadIds.length) {
    const { data: pls } = await sb.from("pipeline_leads").select("id, corretor_id, aceite_status").in("id", leadIds);
    for (const pl of pls ?? []) if (pl.corretor_id && pl.aceite_status === "aceito") repassados.add(pl.id);
  }

  // ficha por produto, pra reengajar específico
  const { data: prods } = await sb.from("lia_produtos").select("slug, ficha");
  const fichaPorProduto: Record<string, string> = {};
  for (const p of prods ?? []) if (p.ficha) fichaPorProduto[p.slug] = p.ficha;

  let enviados = 0;
  for (const c of cands) {
    if (enviados >= REENG_MAX_POR_RODADA) break;
    if (c.repassado_em) continue;                         // já passou o bastão: humano assume
    if (c.lead_id && repassados.has(c.lead_id)) continue; // já tem corretor
    const lu = c.last_user_at ? new Date(c.last_user_at).getTime() : 0;
    const lm = c.last_msg_em ? new Date(c.last_msg_em).getTime() : 0;
    if (!lu || !lm) continue;
    if (lm <= lu) continue;                               // a LIA precisa ter falado por último (esperando o lead)
    const silencioH = (agora - lm) / 3600_000;
    if (silencioH < REENG_MIN_H || silencioH > REENG_MAX_H) continue;
    if ((agora - lu) / 3600_000 > REENG_JANELA_H) continue; // fora da janela free-form de 24h

    // não cutuca se já existe toque de template pendente/aprovado pra esse número
    const { data: aberto } = await sb
      .from("lia_followups").select("id").eq("telefone", c.telefone).in("status", ["pendente", "aprovado"]).limit(1);
    if (aberto && aberto.length) continue;

    const { data: hist } = await sb
      .from("lia_conversas").select("role, conteudo").eq("telefone", c.telefone)
      .order("created_at", { ascending: true }).limit(40);
    const msgs = (hist ?? []).map((x: any) => ({ role: x.role, content: x.conteudo }));
    if (!msgs.length) continue;

    // gera a mensagem contextual pelo cérebro da LIA (modo reengajar)
    let content = "";
    try {
      const ficha = fichaPorProduto[c.produto_slug ?? ""] ?? "";
      const r = await fetch(`${EDGE_BASE}/functions/v1/lia-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
        body: JSON.stringify({ mode: "reengajar", messages: msgs, ...(ficha ? { ficha } : {}) }),
      });
      const d = await r.json();
      content = String(d?.content ?? "").trim();
    } catch (e) {
      console.error("[lia-followup] reengajar chat erro", e);
      continue; // erro transitório: tenta na próxima rodada (não queima o reengajado_em)
    }

    if (!content) { // a IA decidiu que não vale reengajar (PULAR): marca pra não reprocessar
      await sb.from("lia_estado").update({ reengajado_em: nowISO(), updated_at: nowISO() }).eq("telefone", c.telefone);
      continue;
    }

    const ok = await send360Text(c.telefone, content);
    if (ok) {
      await sb.from("lia_conversas").insert({ telefone: c.telefone, role: "assistant", conteudo: content });
      await sb.from("lia_estado").update({ reengajado_em: nowISO(), last_msg_em: nowISO(), updated_at: nowISO() }).eq("telefone", c.telefone);
      enviados++;
    }
  }
  return enviados;
}

/** Dispara os cutucões APROVADOS pelo Lucas, em horário comercial.
 * opts.ignorarHorario: envia mesmo fora da janela (só no envio direcionado).
 * opts.soTelefone: envia só pra este número. */
async function disparar(sb: any, opts: { ignorarHorario?: boolean; soTelefone?: string } = {}): Promise<number> {
  const h = horaBRT();
  if (!opts.ignorarHorario && (h < HORA_INI || h >= HORA_FIM)) return 0; // fora da janela: tenta na próxima rodada

  // nome público do imóvel por produto (vira o {{2}} do template). Sem produto → Casa Tua Santos Ferreira.
  const nomePorProduto: Record<string, string> = {};
  const { data: prodsNome } = await sb.from("lia_produtos").select("slug, nome_publico, nome, empreendimento");
  for (const p of prodsNome ?? []) nomePorProduto[p.slug] = p.nome_publico || p.nome || p.empreendimento || "Casa Tua Santos Ferreira";

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
    const { data: estRows } = await sb.from("lia_estado").select("optout, followup_count, last_user_at, nome, status, produto_slug").eq("telefone", f.telefone).limit(1);
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
      const empPublico = nomePorProduto[est?.produto_slug ?? ""] ?? "Casa Tua Santos Ferreira";
      const res = await sendTemplate(f.telefone, WA_TEMPLATES[f.template_key], [nomeLead, empPublico]);
      ok = res.ok;
      if (!res.ok) {
        // Falhou (ex.: cabeçalho faltando). NÃO repete pra sempre: cancela e AVANÇA o lead pro
        // próximo toque (bumpa followup_count/last_msg_em). No máx MAX_CUTUCOES falhas por lead.
        await sb.from("lia_followups").update({ status: "cancelado", motivo: `ERRO TEMPLATE: ${res.err ?? ""}`.slice(0, 260), updated_at: nowISO() }).eq("id", f.id);
        await sb.from("lia_estado").update({ followup_count: (est?.followup_count ?? 0) + 1, last_msg_em: nowISO(), updated_at: nowISO() }).eq("telefone", f.telefone);
        continue;
      }
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
