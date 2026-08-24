/**
 * _shared/liaFormBridge.ts
 *
 * PONTE DO FORMULÁRIO → LIA. Chamada por receive-meta-lead na ENTRADA do lead.
 * Se a campanha do lead (de FORMULÁRIO) está vinculada a um imóvel da LIA
 * (lia_produtos.campanha_ids, ativo=true), a LIA "puxa conversa" mandando o
 * template aprovado de 1º contato e pré-cadastra a conversa (lia_estado), pra
 * quando o lead responder cair no fluxo multiproduto do lia-whatsapp.
 *
 * REDE DE SEGURANÇA: qualquer falha (sem produto, sem telefone, opt-out, sem
 * template, erro no envio) devolve { desviar:false } → o lead segue o fluxo
 * normal (roleta). Assim NUNCA se perde um lead se a LIA não conseguir puxar.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const D360_URL = "https://waba-v2.360dialog.io/messages";

export interface FormBridgeInput {
  nome?: string | null;
  telefone: string | null;   // normalizado (dígitos, pode vir sem 55)
  campaign_id?: string | null;
  meta_lead_id?: string | null;
  ad_id?: string | null;
  headline?: string | null;
}
export interface FormBridgeResult {
  desviar: boolean;          // true = a LIA assumiu, receive-meta-lead deve PARAR (não roleta)
  motivo?: string;
  produto_slug?: string;
}

// Formato que o WhatsApp usa: 55 + DDD + 9 + 8 dígitos.
function telWa(tel: string): string {
  let d = String(tel).replace(/\D/g, "");
  if (d.startsWith("55")) d = d.slice(2);
  if (d.length === 10) d = d.slice(0, 2) + "9" + d.slice(2);
  return "55" + d;
}
const last8 = (t: string) => t.replace(/\D/g, "").slice(-8);

// Config dos templates APROVADOS (idioma + cabeçalho de documento, se o template exigir).
// Mesmo padrão do lia-followup. Template não listado = pt_BR, só body.
const WA_TEMPLATES: Record<string, { lang: string; headerDoc?: { link: string; filename: string } }> = {
  followup_casatuacanoaslia: {
    lang: "pt_BR",
    headerDoc: { link: "https://uhomesales.com/casatua/guia-casa-tua-santos-ferreira.pdf", filename: "Guia Casa Tua Santos Ferreira.pdf" },
  },
};

// Envia um template WhatsApp aprovado via 360dialog. {{1}} = primeiro nome.
// Retorna { ok, err } — err traz o erro do 360dialog pra diagnóstico.
async function enviarTemplate(to: string, tplName: string, bodyParams: string[]): Promise<{ ok: boolean; err?: string }> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) return { ok: false, err: "sem D360_API_KEY" };
  const cfg = WA_TEMPLATES[tplName] ?? { lang: "pt_BR" };
  const components: any[] = [];
  if (cfg.headerDoc) components.push({ type: "header", parameters: [{ type: "document", document: { link: cfg.headerDoc.link, filename: cfg.headerDoc.filename } }] });
  // O nº de parâmetros PRECISA bater com as variáveis do template ({{1}}, {{2}}, ...), senão o 360dialog rejeita.
  const params = (bodyParams.length ? bodyParams : ["você"]).map((p) => ({ type: "text", text: (p || "você").slice(0, 60) }));
  components.push({ type: "body", parameters: params });
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: { name: tplName, language: { code: cfg.lang }, components },
      }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ""); console.error("[form-bridge] template send", r.status, t); return { ok: false, err: `${r.status} ${t}`.slice(0, 300) }; }
    return { ok: true };
  } catch (e) { return { ok: false, err: String(e).slice(0, 300) }; }
}

// Log de diagnóstico (não bloqueia o fluxo): registra em ops_events o desfecho de cada lead
// que casou com um produto da LIA, pra sabermos EXATAMENTE por que desviou ou não.
async function logPonte(admin: SupabaseClient, motivo: string, ctx: Record<string, unknown>) {
  try { await admin.from("ops_events").insert({ fn: "lia-form-bridge", level: motivo.includes("falh") || motivo === "erro" ? "warn" : "info", category: "business", message: `bridge_${motivo}`, ctx }); } catch (_e) { /* silencioso */ }
}

export async function pontoDeEntradaFormLia(admin: SupabaseClient, input: FormBridgeInput): Promise<FormBridgeResult> {
  try {
    if (!input.telefone || !input.campaign_id) return { desviar: false };

    // 1. A campanha (de formulário) é de algum imóvel ATIVO da LIA?
    const { data: prods } = await admin.from("lia_produtos").select("*").eq("ativo", true);
    const camp = String(input.campaign_id);
    const produto = (prods ?? []).find((p: any) => (p.campanha_ids ?? []).map(String).includes(camp));
    if (!produto) return { desviar: false }; // não é campanha da LIA → roleta normal
    // daqui pra frente o lead CASOU com um produto da LIA — logamos todo desfecho pra diagnóstico.

    const l8 = last8(input.telefone);

    // 2. Opt-out tem precedência: quem pediu pra sair NÃO é recontatado (e não vira lead novo).
    const { data: sup } = await admin.from("meta_supressao").select("id").eq("telefone_last8", l8).limit(1).maybeSingle();
    if (sup) { await logPonte(admin, "opt_out", { slug: produto.slug, camp }); return { desviar: true, motivo: "opt_out" }; }

    // 3a. DEDUP LIA: se o telefone JÁ tem qualquer estado na LIA, NÃO reenvia o 1º contato
    //     (evita disparo duplicado quando o backfill reprocessa a mesma submissão). O reengajamento
    //     de quem já está na LIA é papel do lia-followup, nunca da ponte.
    const { data: jaExiste } = await admin.from("lia_estado").select("telefone,status")
      .ilike("telefone", `%${l8}`).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (jaExiste) {
      await logPonte(admin, "ja_tem_estado_lia", { slug: produto.slug, status: jaExiste.status });
      return { desviar: true, motivo: "ja_tem_estado_lia" };
    }

    // 3b. DEDUP PIPELINE: se já é lead ativo NO PIPELINE com corretor, o humano assumiu —
    //     a LIA NÃO cutuca de novo (evita contato duplicado com quem o time já atende).
    const { data: jaPipe } = await admin.from("pipeline_leads").select("id")
      .ilike("telefone", `%${l8}`).not("corretor_id", "is", null).eq("arquivado", false).limit(1).maybeSingle();
    if (jaPipe) {
      await logPonte(admin, "ja_no_pipeline_com_corretor", { slug: produto.slug });
      return { desviar: true, motivo: "ja_no_pipeline_com_corretor" };
    }

    // 4. Template de PRIMEIRO CONTATO aprovado (mensagem de boas-vindas, NUNCA o de reativação
    //    "procura-se"). SEM ele, a LIA NÃO manda nada e o lead segue pra roleta — jamais um
    //    template errado sai pra um lead que acabou de se cadastrar.
    const tplName = produto.template_primeiro_contato;
    if (!tplName) { await logPonte(admin, "sem_template_primeiro_contato", { slug: produto.slug }); return { desviar: false, motivo: "sem_template_primeiro_contato" }; }

    const to = telWa(input.telefone);
    // primeirocontato_lia tem 2 variáveis: {{1}} = primeiro nome, {{2}} = nome público do imóvel
    // (ex.: "Casa Tua Canoas"). O nº de params PRECISA bater com o template, senão o 360dialog rejeita.
    const primeiroNome = (input.nome || "").trim().split(/\s+/)[0] || "você";
    const empPublico = produto.nome_publico || produto.nome || produto.empreendimento || "nosso empreendimento";
    const env = await enviarTemplate(to, tplName, [primeiroNome, empPublico]);
    if (!env.ok) { await logPonte(admin, "envio_falhou", { slug: produto.slug, tpl: tplName, to, err: env.err }); return { desviar: false, motivo: "envio_falhou" }; } // FALHOU → roleta (rede de segurança)

    // 4. Pré-cadastra a conversa pra quando o lead responder cair no produto certo.
    const referral = {
      source_id: input.ad_id ?? null,
      campaign_id: camp,
      headline: input.headline ?? null,
      source_type: "form_lead",
    };
    const nowIso = new Date().toISOString();
    await admin.from("lia_estado").upsert({
      telefone: to, nome: input.nome ?? null, produto_slug: produto.slug,
      status: "novo", referral, last_msg_em: nowIso, updated_at: nowIso,
    }, { onConflict: "telefone" });

    await logPonte(admin, "template_enviado", { slug: produto.slug, tpl: tplName, to });
    return { desviar: true, motivo: "template_enviado", produto_slug: produto.slug };
  } catch (e) {
    console.error("[form-bridge] erro", e);
    return { desviar: false, motivo: "erro" }; // qualquer erro → roleta (nunca perde lead)
  }
}
