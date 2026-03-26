import { differenceInDays, differenceInHours, format, formatDistanceToNow } from "date-fns";
import { differenceInMinutes } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as Brazilian Real (BRL) — full format.
 * E.g. 1500000 → "R$ 1.500.000,00"
 *      240000  → "R$ 240.000,00"
 * @param decimals number of decimal places (default 0 for imobiliário)
 */
export function formatBRL(v: number | null | undefined, decimals = 0): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Compact BRL for KPI cards and small spaces.
 * E.g. 1500000 → "R$ 1,5M"
 *      240000  → "R$ 240k"
 *      800     → "R$ 800"
 */
export function formatBRLCompact(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return formatBRL(v);
}

function parseDateValue(value: string | Date | null | undefined, dateOnly = false): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value) return null;

  const normalized = dateOnly && !value.includes("T") ? `${value}T12:00:00` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns today's date as "YYYY-MM-DD" in America/Sao_Paulo timezone.
 * Use this everywhere instead of `new Date().toISOString().slice(0,10)` or `format(new Date(), "yyyy-MM-dd")`.
 */
export function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Returns a given Date as "YYYY-MM-DD" in America/Sao_Paulo timezone.
 */
export function dateToBRT(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Converts a BRT date range (YYYY-MM-DD) to UTC ISO timestamps.
 * BRT = UTC-3, so start of day in BRT = 03:00 UTC, end of day = next day 02:59:59 UTC.
 */
export function brtRangeToUTC(range: { start: string; end: string }): { startUtc: string; endUtc: string } {
  return {
    startUtc: `${range.start}T03:00:00Z`,
    endUtc: `${range.end}T03:00:00Z`,
  };
}

/**
 * Returns the UTC end-of-day timestamp for a BRT date.
 * End of "2026-03-25" in BRT = "2026-03-26T02:59:59Z"
 */
export function brtEndOfDayUTC(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59));
  return nextDay.toISOString();
}

/**
 * Safely parses a "YYYY-MM-DD" date string as noon local time,
 * avoiding the UTC midnight pitfall where isToday/isTomorrow would be off by 1 day in BRT.
 * For full ISO strings (with T), returns normal Date parse.
 */
export function parseDateBRT(dateStr: string): Date {
  return parseDateBRTSafe(dateStr) ?? new Date();
}

export function parseDateBRTSafe(dateStr?: string | null): Date | null {
  return parseDateValue(dateStr, true);
}

export function parseDateTimeSafe(dateStr?: string | null): Date | null {
  return parseDateValue(dateStr, false);
}

export function isValidDateValue(value: string | Date | null | undefined, dateOnly = false): boolean {
  return parseDateValue(value, dateOnly) !== null;
}

export function formatDateSafe(
  value: string | Date | null | undefined,
  pattern: string,
  options?: { fallback?: string; dateOnly?: boolean; [key: string]: unknown },
): string {
  const { fallback = "—", dateOnly = false, ...formatOptions } = options || {};
  const parsed = parseDateValue(value, dateOnly);
  return parsed ? format(parsed, pattern, formatOptions as Parameters<typeof format>[2]) : fallback;
}

export function formatDistanceToNowSafe(
  value: string | Date | null | undefined,
  options?: { fallback?: string; dateOnly?: boolean; [key: string]: unknown },
): string {
  const { fallback = "—", dateOnly = false, ...distanceOptions } = options || {};
  const parsed = parseDateValue(value, dateOnly);
  return parsed
    ? formatDistanceToNow(parsed, distanceOptions as Parameters<typeof formatDistanceToNow>[1])
    : fallback;
}

export function differenceInHoursSafe(value: string | Date | null | undefined, dateOnly = false): number | null {
  const parsed = parseDateValue(value, dateOnly);
  return parsed ? differenceInHours(new Date(), parsed) : null;
}

export function differenceInDaysSafe(value: string | Date | null | undefined, dateOnly = false): number | null {
  const parsed = parseDateValue(value, dateOnly);
  return parsed ? differenceInDays(new Date(), parsed) : null;
}

export function differenceInMinutesSafe(value: string | Date | null | undefined, dateOnly = false): number | null {
  const parsed = parseDateValue(value, dateOnly);
  return parsed ? differenceInMinutes(new Date(), parsed) : null;
}
