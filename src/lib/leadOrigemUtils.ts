/**
 * leadOrigemUtils.ts — Classificação canônica de origem de leads
 *
 * Source of truth para distinguir leads de Marketing vs. Oferta Ativa.
 * Trata variações de string (case-insensitive, snake_case vs Title Case)
 * e valores NULL de forma consistente em todo o sistema.
 *
 * Regras:
 *  - "Oferta Ativa" / "oferta_ativa" / "oferta ativa" / qualquer LOWER contendo "oferta" + "ativa" → Oferta Ativa
 *  - Tudo o restante (incluindo NULL/vazio) → Marketing (campanhas, LP, ImovelWeb, RD, etc.)
 *
 * Use estas helpers SEMPRE que filtrar leads por origem em dashboards
 * para garantir paridade entre KPIs e gráficos.
 */

function normalize(origem?: string | null): string {
  return (origem ?? "").toString().trim().toLowerCase();
}

/** Returns true if the lead came from the active-offer (recycled) flow. */
export function isOfertaAtiva(origem?: string | null): boolean {
  const n = normalize(origem);
  if (!n) return false;
  if (n === "oferta_ativa") return true;
  return n.includes("oferta") && n.includes("ativa");
}

/** Returns true if the lead came from a marketing source (everything that is NOT Oferta Ativa). */
export function isLeadDeMarketing(origem?: string | null): boolean {
  return !isOfertaAtiva(origem);
}

/** Friendly label used in dashboards when origem is missing. */
export const SEM_EMPREENDIMENTO_LABEL = "Sem empreendimento";

/** Returns the empreendimento string with a stable fallback. */
export function empreendimentoLabel(emp?: string | null): string {
  const v = (emp ?? "").toString().trim();
  return v.length > 0 ? v : SEM_EMPREENDIMENTO_LABEL;
}
