/**
 * Temperatura do cliente — escala única do CRM (decisão do Lucas, 04/11/2026):
 * Frio, Morno e Quente. "nao_definida" = ainda sem classificação.
 * Valores antigos são lidos na escala nova (muito_quente/urgente → quente, gelado → frio).
 * O banco também normaliza na gravação (trigger em pipeline_leads).
 */
export type Temperatura = "frio" | "morno" | "quente";
export type TemperaturaOuVazia = Temperatura | "nao_definida";

export const TEMPERATURAS: Temperatura[] = ["frio", "morno", "quente"];

export const TEMPERATURA_LABEL: Record<TemperaturaOuVazia, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
  nao_definida: "Sem temperatura",
};

export const TEMPERATURA_EMOJI: Record<TemperaturaOuVazia, string> = {
  frio: "🧊",
  morno: "🌡️",
  quente: "🔥",
  nao_definida: "⚪",
};

export function normalizarTemperatura(v?: string | null): TemperaturaOuVazia {
  const s = (v || "").trim().toLowerCase();
  if (s === "quente" || s === "muito_quente" || s === "urgente") return "quente";
  if (s === "morno") return "morno";
  if (s === "frio" || s === "gelado") return "frio";
  return "nao_definida";
}

export function rotuloTemperatura(v?: string | null): string {
  const t = normalizarTemperatura(v);
  return `${TEMPERATURA_EMOJI[t]} ${TEMPERATURA_LABEL[t]}`;
}
