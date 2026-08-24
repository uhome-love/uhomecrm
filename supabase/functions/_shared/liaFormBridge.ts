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

// Envia um template WhatsApp aprovado via 360dialog. {{1}} = primeiro nome. Retorna true só se OK.
async function enviarTemplate(to: string, tplName: string, nome: string): Promise<boolean> {
  const key = Deno.env.get("D360_API_KEY");
  if (!key) { console.error("[form-bridge] D360_API_KEY ausente"); return false; }
  const cfg = WA_TEMPLATES[tplName] ?? { lang: "pt_BR" };
  const components: any[] = [];
  if (cfg.headerDoc) components.push({ type: "header", parameters: [{ type: "document", document: { link: cfg.headerDoc.link, filename: cfg.headerDoc.filename } }] });
  components.push({ type: "body", parameters: [{ type: "text", text: (nome || "você").slice(0, 60) }] });
  try {
    const r = await fetch(D360_URL, {
      method: "POST",
      headers: { "D360-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: { name: tplName, language: { code: cfg.lang }, components },
      }),
    });
    if (!r.ok) { console.error("[form-bridge] template send", r.status, await r.text().catch(() => "")); return false; }
    return true;
  } catch (e) { console.error("[form-bridge] envio erro", e); return false; }
}

export async function pontoDeEntradaFormLia(admin: SupabaseClient, input: FormBridgeInput): Promise<FormBridgeResult> {
  try {
    if (!input.telefone || !input.campaign_id) return { desviar: false };

    // 1. A campanha (de formulário) é de algum imóvel ATIVO da LIA?
    const { data: prods } = await admin.from("lia_produtos").select("*").eq("ativo", true);
    const camp = String(input.campaign_id);
    const produto = (prods ?? []).find((p: any) => (p.campanha_ids ?? []).map(String).includes(camp));
    if (!produto) return { desviar: false }; // não é campanha da LIA → roleta normal

    const l8 = last8(input.telefone);

    // 2. Opt-out tem precedência: quem pediu pra sair NÃO é recontatado (e não vira lead novo).
    const { data: sup } = await admin.from("meta_supressao").select("id").eq("telefone_last8", l8).limit(1).maybeSingle();
    if (sup) return { desviar: true, motivo: "opt_out" }; // não manda nada, e não joga na roleta

    // 3. DEDUP: se o telefone já tem conversa ATIVA ou encerrada da LIA, NÃO re-mensageia nem
    //    duplica na roleta (ele já é da LIA). Só lead realmente novo recebe o 1º contato.
    const { data: jaExiste } = await admin.from("lia_estado").select("telefone,status")
      .ilike("telefone", `%${l8}`).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (jaExiste && ["em_conversa", "qualificado", "opt_out", "descartado"].includes(String(jaExiste.status))) {
      return { desviar: true, motivo: "ja_em_atendimento_lia" };
    }

    // 4. Template de PRIMEIRO CONTATO aprovado (mensagem de boas-vindas, NUNCA o de reativação
    //    "procura-se"). SEM ele, a LIA NÃO manda nada e o lead segue pra roleta — jamais um
    //    template errado sai pra um lead que acabou de se cadastrar.
    const tplName = produto.template_primeiro_contato;
    if (!tplName) return { desviar: false, motivo: "sem_template_primeiro_contato" };

    const to = telWa(input.telefone);
    // Params do template: por ora {{1}} = primeiro nome. (Se o template pedir mais, ajustar aqui.)
    const primeiroNome = (input.nome || "").trim().split(/\s+/)[0] || "";
    const enviou = await enviarTemplate(to, tplName, primeiroNome);
    if (!enviou) return { desviar: false, motivo: "envio_falhou" }; // FALHOU → roleta (rede de segurança)

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

    return { desviar: true, motivo: "template_enviado", produto_slug: produto.slug };
  } catch (e) {
    console.error("[form-bridge] erro", e);
    return { desviar: false, motivo: "erro" }; // qualquer erro → roleta (nunca perde lead)
  }
}
