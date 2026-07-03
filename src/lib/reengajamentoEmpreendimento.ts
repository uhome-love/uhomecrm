/**
 * reengajamentoEmpreendimento.ts — Mapeia o nome do template de disparo de
 * reengajamento (reengajamento_meta_disparos.template_name) para o rótulo do
 * empreendimento correspondente.
 *
 * Usado na Fila CEO para deixar claro de qual campanha/empreendimento o lead
 * reengajado veio (ex.: template "lakebaical_novidade" → "Lake Baikal").
 *
 * Regra: casamento por inclusão, case-insensitive. Templates genéricos (sem
 * empreendimento específico) retornam null — nesses casos não exibimos badge.
 */

interface TemplateRule {
  match: (t: string) => boolean;
  empreendimento: string;
}

const RULES: TemplateRule[] = [
  { match: (t) => t.includes("lakebaical") || t.includes("lake baical") || t.includes("lakebaikal"), empreendimento: "Lake Baikal" },
  { match: (t) => t.includes("casatua") || t.includes("casa tua") || t.includes("casa_tua"), empreendimento: "Casa Tua" },
  { match: (t) => t.includes("vivid"), empreendimento: "Vivid Terrace" },
  { match: (t) => t.includes("atrio") || t.includes("átrio"), empreendimento: "Átrio" },
];

/**
 * Retorna o empreendimento correspondente ao template, ou null quando o template
 * é genérico / desconhecido.
 */
export function empreendimentoFromTemplate(templateName?: string | null): string | null {
  const t = (templateName ?? "").toString().trim().toLowerCase();
  if (!t) return null;
  for (const rule of RULES) {
    if (rule.match(t)) return rule.empreendimento;
  }
  return null;
}
