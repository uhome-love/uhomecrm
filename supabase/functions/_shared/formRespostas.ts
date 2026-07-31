// ─────────────────────────────────────────────────────────────
// formRespostas — extrai as perguntas de qualificação dos
// formulários de anúncio (Meta Lead Ads, Make.com, landing).
//
// Genérico de propósito: cada empreendimento tem a sua própria
// pergunta, então NÃO existe lista fixa de perguntas aqui — tudo
// que não for identificação (nome/email/telefone) vira resposta.
// ─────────────────────────────────────────────────────────────

export interface FormResposta {
  pergunta: string;
  resposta: string;
}

/** Campos de identificação/rastreio que nunca são "resposta de pergunta". */
const IGNORED_KEYS = [
  "full_name", "first_name", "last_name", "name", "nome", "sobrenome",
  "email", "e-mail", "mail",
  "phone", "phone_number", "telefone", "celular", "whatsapp", "cel",
  "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
  "form_id", "form_name", "formulario", "platform", "plataforma",
  "lead_id", "leadgen_id", "meta_lead_id", "id", "created_time",
  "property_code", "codigo_imovel", "imovel_referencia", "imovel_ref",
  "fbc", "fbp", "fbclid", "utm_source", "utm_medium", "utm_campaign",
  "utm_term", "utm_content", "gclid", "page_id", "page_url", "user_agent", "ip",
];

function isIgnored(rawName: string): boolean {
  const k = rawName.trim().toLowerCase();
  if (!k) return true;
  if (IGNORED_KEYS.includes(k)) return true;
  return IGNORED_KEYS.some((ign) => ign.length > 4 && k.includes(ign));
}

/** "qual_a_sua_preferencia?" → "Qual a sua preferencia?" */
function humanize(rawName: string): string {
  const s = rawName.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function firstValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x).trim()).join(", ");
  if (typeof v === "object") return "";
  return String(v).trim();
}

/**
 * Recebe o body cru do webhook e devolve as respostas do formulário.
 * Nunca lança — em qualquer erro devolve [].
 */
export function parseFormRespostas(body: Record<string, unknown> | null | undefined): FormResposta[] {
  const out: FormResposta[] = [];
  const seen = new Set<string>();

  const push = (perguntaRaw: string, respostaRaw: unknown) => {
    const resposta = firstValue(respostaRaw);
    if (!resposta) return;
    const pergunta = (perguntaRaw || "").trim();
    if (!pergunta || isIgnored(pergunta)) return;
    const label = /[?？]$/.test(pergunta) || pergunta.includes(" ") ? humanize(pergunta) : humanize(pergunta);
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ pergunta: label, resposta });
  };

  try {
    if (!body || typeof body !== "object") return [];

    // Meta Ads nativo: field_data [{ name, label?, question?, values: [] }]
    const fd = (body as any).field_data;
    if (Array.isArray(fd)) {
      for (const f of fd) {
        const label = (f?.label || f?.question || f?.name || "") as string;
        push(String(f?.name || label), f?.values ?? f?.value);
        // se o label humano existir e o name for técnico, prefere o label
        if (out.length && label && f?.name && label !== f.name) {
          const last = out[out.length - 1];
          if (last.pergunta.toLowerCase() === humanize(String(f.name)).toLowerCase()) {
            last.pergunta = String(label).trim();
          }
        }
      }
    }

    // Make.com: mappable_field_data [{ name, label?, value }]
    const mfd = (body as any).mappable_field_data;
    if (Array.isArray(mfd)) {
      for (const f of mfd) {
        const label = (f?.label || f?.question || f?.name || "") as string;
        push(String(label || f?.name || ""), f?.value ?? f?.values);
      }
    }

    // Respostas já estruturadas (landing / integrações): respostas | custom_fields | perguntas
    for (const key of ["respostas", "form_respostas", "custom_fields", "perguntas"]) {
      const arr = (body as any)[key];
      if (Array.isArray(arr)) {
        for (const f of arr) {
          if (typeof f !== "object" || !f) continue;
          push(String(f.pergunta ?? f.question ?? f.label ?? f.name ?? ""), f.resposta ?? f.answer ?? f.value ?? f.values);
        }
      } else if (arr && typeof arr === "object") {
        for (const [k, v] of Object.entries(arr)) push(k, v);
      }
    }
  } catch (_e) {
    return out;
  }

  return out;
}

/** Texto legível para observações/atividades. */
export function formatFormRespostas(respostas: FormResposta[]): string {
  if (!respostas?.length) return "";
  return respostas.map((r) => `• ${r.pergunta} ${r.resposta}`).join("\n");
}
