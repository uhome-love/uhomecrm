// ─────────────────────────────────────────────────────────────────
// brt-time — Helper compartilhado para Edge Functions garantirem
// que todo timestamp seja interpretado/exibido em America/Sao_Paulo.
//
// REGRA: instantes (timestamptz no Postgres) já são corretos sem conversão.
// Esta lib serve para:
//   1) Normalizar timestamps de webhooks externos sem TZ → BRT
//   2) Formatar para logs/templates em BRT
//   3) Calcular "hoje" em BRT (consistente com SQL `AT TIME ZONE`)
// ─────────────────────────────────────────────────────────────────

export const BRT_TIMEZONE = "America/Sao_Paulo";

/**
 * Normaliza um timestamp recebido (webhook, Meta, etc) para ISO com TZ explícito.
 * - Já tem TZ (Z, +HH:MM): preserva
 * - Sem TZ: assume BRT (-03:00)
 * - Só data: assume 00:00 BRT
 */
export function normalizeToBRT(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) return trimmed;
  if (trimmed.includes("T")) return `${trimmed}-03:00`;
  if (/^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}/.test(trimmed)) return `${trimmed.replace(" ", "T")}-03:00`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00-03:00`;
  return trimmed;
}

/** Hoje em "YYYY-MM-DD" no fuso BRT (consistente com `(now() AT TIME ZONE 'America/Sao_Paulo')::date`). */
export function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BRT_TIMEZONE });
}

/** Formata uma data em BRT no padrão dd/MM HH:mm — para logs e mensagens. */
export function formatBRT(value: string | Date | number | null | undefined, includeDate = true): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: BRT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  if (includeDate) {
    opts.day = "2-digit";
    opts.month = "2-digit";
  }
  return new Intl.DateTimeFormat("pt-BR", opts).format(d);
}

/** Minutos decorridos desde value (TZ-independent — para SLAs). */
export function minutesSince(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 60000;
}

/** Hora BRT atual em minutos desde 00:00 — usado por janelas de turno. */
export function brtMinutesOfDay(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}
