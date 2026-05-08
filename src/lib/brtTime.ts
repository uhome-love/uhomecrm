// ─────────────────────────────────────────────────────────────────
// brtTime — Single source of truth para datas/horas em BRT (America/Sao_Paulo)
//
// REGRA OBRIGATÓRIA: todo display de hora/data e todo cálculo de "hoje"/"agora"
// no CRM deve passar por este módulo. NUNCA use `format(new Date(x), "HH:mm")`
// direto — isso usa o timezone do navegador e quebra para usuários fora de BRT.
//
// Cálculos de duração (ex: "minutos desde X") são TZ-independent e podem usar
// `Date.now() - new Date(x).getTime()`. Mas para EXIBIR em formato local, sempre BRT.
// ─────────────────────────────────────────────────────────────────

export const BRT_TIMEZONE = "America/Sao_Paulo";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formata uma data/hora SEMPRE em BRT, ignorando o timezone do navegador.
 *
 * Padrões suportados (subset do date-fns):
 *   yyyy / yy / MM / dd / HH / mm / ss / SSS
 *
 * Para padrões com palavras (ex: "EEEE", "MMM"), use `formatBRTLocale`.
 *
 * @example
 *   formatBRT(lead.distribuido_em, "HH:mm")          // "20:05"
 *   formatBRT(lead.created_at, "dd/MM HH:mm")        // "08/05 20:05"
 *   formatBRT(now, "yyyy-MM-dd")                     // "2026-05-08"
 */
export function formatBRT(value: DateInput, pattern: string, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;

  // Intl returns parts already converted to BRT
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    fractionalSecondDigits: 3,
  }).formatToParts(d);

  const lookup: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") lookup[p.type] = p.value;
  }
  // Hour with hourCycle h23 may render "24" — normalize to "00"
  if (lookup.hour === "24") lookup.hour = "00";

  return pattern
    .replace(/yyyy/g, lookup.year ?? "")
    .replace(/yy/g, (lookup.year ?? "").slice(-2))
    .replace(/MM/g, lookup.month ?? "")
    .replace(/dd/g, lookup.day ?? "")
    .replace(/HH/g, lookup.hour ?? "")
    .replace(/mm/g, lookup.minute ?? "")
    .replace(/ss/g, lookup.second ?? "")
    .replace(/SSS/g, lookup.fractionalSecond ?? "000");
}

/**
 * Versão localizada (pt-BR) para padrões com nomes de mês/dia da semana.
 * Usa Intl direto — não suporta padrões customizados, apenas presets.
 */
export function formatBRTLocale(
  value: DateInput,
  preset: "datetime" | "date" | "time" | "datetime-long" | "weekday-time",
  fallback = "—",
): string {
  const d = toDate(value);
  if (!d) return fallback;

  const opts: Intl.DateTimeFormatOptions = { timeZone: BRT_TIMEZONE };
  switch (preset) {
    case "datetime":
      Object.assign(opts, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
      break;
    case "date":
      Object.assign(opts, { day: "2-digit", month: "2-digit", year: "numeric" });
      break;
    case "time":
      Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: false });
      break;
    case "datetime-long":
      Object.assign(opts, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
      break;
    case "weekday-time":
      Object.assign(opts, { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
      break;
  }
  return new Intl.DateTimeFormat("pt-BR", opts).format(d);
}

/**
 * Hora atual em BRT (Date object). O instante é o mesmo que `new Date()`,
 * mas exposto via função para deixar a intenção explícita no código.
 */
export function nowBRT(): Date {
  return new Date();
}

/**
 * Data de hoje em BRT no formato "YYYY-MM-DD". Use sempre que precisar
 * comparar com colunas `date` do Postgres (que são puramente BRT no nosso CRM).
 */
export function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRT_TIMEZONE });
}

/**
 * Converte um Date para "YYYY-MM-DD" em BRT.
 */
export function dateToBRT(date: DateInput): string {
  const d = toDate(date);
  return d ? d.toLocaleDateString("en-CA", { timeZone: BRT_TIMEZONE }) : "";
}

/**
 * Minutos decorridos entre `value` e agora.
 * Cálculo TZ-independent (instante puro). Útil para SLA.
 *
 * @returns número (positivo se value é passado, negativo se futuro), ou null.
 */
export function minutesSince(value: DateInput): number | null {
  const d = toDate(value);
  if (!d) return null;
  return (Date.now() - d.getTime()) / 60000;
}

/**
 * Segundos restantes até `value` (futuro). Negativo se já passou.
 */
export function secondsUntil(value: DateInput): number | null {
  const d = toDate(value);
  if (!d) return null;
  return (d.getTime() - Date.now()) / 1000;
}

/**
 * "YYYY-MM-DDTHH:mm:ss-03:00" — útil para enviar ao backend deixando
 * explícito o offset BRT (evita ambiguidade quando integrações externas
 * mandam timestamp sem TZ).
 */
export function toBRTISOString(value: DateInput): string | null {
  const d = toDate(value);
  if (!d) return null;
  const date = formatBRT(d, "yyyy-MM-dd");
  const time = formatBRT(d, "HH:mm:ss");
  return `${date}T${time}-03:00`;
}

/**
 * Garante que um timestamp recebido (ex: de webhook externo) seja interpretado
 * em BRT. Se já tem TZ explícito, mantém. Se não tem, assume BRT.
 *
 * @example
 *   normalizeToBRT("2026-05-08 20:05:00")        → "2026-05-08T20:05:00-03:00"
 *   normalizeToBRT("2026-05-08T20:05:00Z")       → "2026-05-08T20:05:00Z" (mantém UTC)
 *   normalizeToBRT("2026-05-08T20:05:00-03:00")  → mantém
 */
export function normalizeToBRT(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // já tem TZ (Z, +HH:MM, -HH:MM no final)
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) return trimmed;
  // tem T separator: assume BRT
  if (trimmed.includes("T")) return `${trimmed}-03:00`;
  // formato "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
    return `${trimmed.replace(" ", "T")}-03:00`;
  }
  // só data
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00-03:00`;
  return trimmed;
}

/**
 * Hora BRT atual em minutos desde 00:00 (0..1439). Usado para janelas de turno.
 */
export function brtMinutesOfDay(): number {
  const hh = Number(formatBRT(new Date(), "HH"));
  const mm = Number(formatBRT(new Date(), "mm"));
  return hh * 60 + mm;
}
