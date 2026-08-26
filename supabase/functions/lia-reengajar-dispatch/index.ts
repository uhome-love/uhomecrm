/**
 * lia-reengajar-dispatch — motor de REENGAJAMENTO da LIA (cron).
 *
 * Para cada RUN com status 'ativo', manda o template APROVADO (via 360dialog, número
 * da LIA) até o cap/dia do run, em LOTES PEQUENOS com intervalo (pra não queimar o número).
 * A resposta do lead cai na lia-whatsapp e a LIA atende / qualifica / ressuscita normalmente.
 *
 * TRAVAS DE SEGURANÇA:
 *  - Kill switch: system_flags.lia_reengajamento_enabled (default FALSE) — sem ele, não faz NADA.
 *  - Só horário comercial (9h-20h BRT).
 *  - Teto por execução (lotes pequenos) + intervalo entre envios.
 *  - Revalida opt-out e lead-vivo antes de cada envio.
 *
 * Público (verify_jwt=false), chamado pelo pg_cron. NÃO toca no fluxo dos leads Meta.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const D360_URL = "https://waba-v2.360dialog.io/messages";
const HORA_INI = 9, HORA_FIM = 20;
const LOTE_INTERVALO_MS = 8000; // espaçamento entre envios (proteção do número)
const MAX_POR_EXECUCAO = 12;    // teto por rodada de cron (lote pequeno)
const TEMPLATE_LANG = "pt_BR";
const TEMPLATE_VARS: Record<string, number> = {
  lia_reengajar_produto: 2,   // {{1}} nome, {{2}} imóvel
  lia_reengajar_cardapio: 5,  // {{1}} nome + {{2}}..{{5}} os 4 imóveis do menu
};
// Header de MÍDIA por template. O WhatsApp EXIGE a mídia no disparo (a amostra da aprovação
// serve só pra aprovar, não pro envio). O cardápio tem imagem no cabeçalho.
const TEMPLATE_HEADER: Record<string, { type: "image" | "document"; link: string; filename?: string }> = {
  lia_reengajar_cardapio: { type: "image", link: "https://uhomesales.com/lia/cardapio.png" },
};
// O corpo do cardápio tem 5 variáveis: {{1}} nome + {{2}}..{{5}} os 4 imóveis do menu (a opção 5 é
// texto fixo). Estes textos batem com os exemplos aprovados no Meta. ATUALIZAR se o menu mudar.
const CARDAPIO_ITENS = [
  "Flow, junto ao Bourbon Ipiranga, lofts, 1 e 2D a partir de R$ 240 mil",
  "Casa Tua Alto Petrópolis, Casas em condomínio na Av. Protásio, a partir de R$ 514 mil",
  "AWA, lofts pra investir (Carlos Gomes com a Nilo), a partir de R$ 339 mil",
  "Lake Baikal, 197 a 254 m² no Bairro Golden Lake",
];
function bodyParamsPara(templateKey: string, nome: string, produtoNome: string): string[] {
  if (templateKey === "lia_reengajar_cardapio") return [nome, ...CARDAPIO_ITENS];
  if ((TEMPLATE_VARS[templateKey] ?? 1) >= 2) return [nome, produtoNome || "seu imóvel"];
  return [nome];
}

const svc = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const nowISO = () => new Date().toISOString();
const primeiroNome = (n: string | null) => (n || "").trim().split(/\s+/)[0] || "";
const horaBRT = () => parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit" }), 10);
const inicioDiaISO = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Número no formato do WhatsApp (55 + DDD + número). Não inventa o 9º dígito: usa o que está no cadastro.
const toWa = (raw: string) => { let d = (raw || "").replace(/\D/g, ""); if (d.startsWith("55")) d = d.slice(2); return "55" + d; };

async function sendTemplate(to: string, name: string, bodyParams: string[]): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return { ok: false, err: "sem D360_API_KEY" };
  const components: any[] = [];
  const hdr = TEMPLATE_HEADER[name];
  if (hdr) {
    const param = hdr.type === "image"
      ? { type: "image", image: { link: hdr.link } }
      : { type: "document", document: { link: hdr.link, filename: hdr.filename || "material.pdf" } };
    components.push({ type: "header", parameters: [param] });
  }
  if (bodyParams.length > 0) {
    components.push({ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: (t || "você").replace(/\s*\n\s*/g, " ").slice(0, 300) })) });
  }
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name, language: { code: TEMPLATE_LANG }, components } }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); return { ok: false, err: `${r.status} ${t}`.slice(0, 240) }; }
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e).slice(0, 240) }; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = svc();

    // TESTE do template do cardápio: manda o lia_reengajar_cardapio (com a imagem do header) pros
    // números informados, SEM tocar na fila, nas runs nem no kill switch. Só pra validar o envio.
    const body = await req.json().catch(() => ({} as any));
    if (Array.isArray(body?.testeCardapio) && body.testeCardapio.length) {
      const res: any[] = [];
      for (const num of body.testeCardapio.slice(0, 5)) {
        const nome = primeiroNome(body?.nome ?? null) || "você";
        const r = await sendTemplate(toWa(String(num)), "lia_reengajar_cardapio", bodyParamsPara("lia_reengajar_cardapio", nome, ""));
        res.push({ to: toWa(String(num)), ok: r.ok, err: r.err });
        await sleep(400);
      }
      return new Response(JSON.stringify({ ok: true, teste: res }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 1) KILL SWITCH
    const { data: flag } = await sb.from("system_flags").select("flag_value").eq("flag_name", "lia_reengajamento_enabled").maybeSingle();
    if (!flag?.flag_value) return new Response(JSON.stringify({ ok: true, skip: "desligado" }), { headers: { ...cors, "Content-Type": "application/json" } });

    // 2) HORÁRIO COMERCIAL
    const h = horaBRT();
    if (h < HORA_INI || h >= HORA_FIM) return new Response(JSON.stringify({ ok: true, skip: "fora de horario" }), { headers: { ...cors, "Content-Type": "application/json" } });

    // nome público por produto (pro {{2}})
    const nomePorProduto: Record<string, string> = {};
    const { data: prods } = await sb.from("lia_produtos").select("slug, nome_publico, nome, empreendimento");
    for (const p of prods ?? []) nomePorProduto[p.slug] = p.nome_publico || p.nome || p.empreendimento || "";

    const { data: runs } = await sb.from("lia_reengajamento_runs").select("*").eq("status", "ativo");
    if (!runs?.length) return new Response(JSON.stringify({ ok: true, enviados: 0, runs: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });

    let enviados = 0;
    for (const run of runs) {
      if (enviados >= MAX_POR_EXECUCAO) break;

      // quantos já foram HOJE neste run (respeita o cap/dia)
      const { count: enviadosHoje } = await sb.from("lia_reengajamento_fila")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id).eq("status", "enviado").gte("enviado_em", inicioDiaISO());
      const restanteDia = Math.max(0, (run.cap_dia ?? 0) - (enviadosHoje ?? 0));
      if (restanteDia <= 0) continue;

      const pegar = Math.min(restanteDia, MAX_POR_EXECUCAO - enviados);
      const { data: pend } = await sb.from("lia_reengajamento_fila")
        .select("*").eq("run_id", run.id).eq("status", "pendente").order("criado_em", { ascending: true }).limit(pegar);

      if (!pend?.length) {
        const { count: restam } = await sb.from("lia_reengajamento_fila").select("id", { count: "exact", head: true }).eq("run_id", run.id).eq("status", "pendente");
        if (!restam) await sb.from("lia_reengajamento_runs").update({ status: "concluido", concluido_em: nowISO(), updated_at: nowISO() }).eq("id", run.id);
        continue;
      }

      for (const f of pend) {
        if (enviados >= MAX_POR_EXECUCAO) break;
        const tel8 = (f.tel8 || (f.telefone || "").replace(/\D/g, "").slice(-8));

        // revalida opt-out e lead-vivo (entre o armar e o disparo)
        const { data: opt } = await sb.from("lia_estado").select("telefone").ilike("telefone", `%${tel8}`).eq("optout", true).limit(1);
        if (opt && opt.length) { await sb.from("lia_reengajamento_fila").update({ status: "cancelado", erro: "optout" }).eq("id", f.id); continue; }
        const { data: vivo } = await sb.from("pipeline_leads").select("id").ilike("telefone", `%${tel8}`).eq("arquivado", false).limit(1);
        if (vivo && vivo.length) { await sb.from("lia_reengajamento_fila").update({ status: "cancelado", erro: "ja_tem_lead_vivo" }).eq("id", f.id); continue; }

        const nome = primeiroNome(f.nome);
        const bodyParams = bodyParamsPara(f.template_key, nome, nomePorProduto[f.produto_slug ?? ""]);

        const res = await sendTemplate(toWa(f.telefone), f.template_key, bodyParams);
        if (res.ok) {
          await sb.from("lia_reengajamento_fila").update({ status: "enviado", enviado_em: nowISO() }).eq("id", f.id);
          enviados++;
          await sleep(LOTE_INTERVALO_MS);
        } else {
          await sb.from("lia_reengajamento_fila").update({ status: "erro", erro: res.err ?? "falha" }).eq("id", f.id);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, enviados }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[lia-reengajar-dispatch] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
