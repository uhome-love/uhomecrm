/**
 * Unified BRL money formatter.
 *
 * Use this everywhere instead of ad-hoc `toLocaleString("pt-BR", { style: "currency" ... })`,
 * `Intl.NumberFormat` calls, or hand-rolled `(v / 1_000_000).toFixed(1)`.
 *
 * Modes:
 *   - 'exact'             → "R$ 925.740" (no decimals by default)
 *   - 'short'             → "R$ 926k" / "R$ 1,5M" / "R$ 1,2B" (rounded)
 *   - 'shortWithTooltip'  → { display: "R$ 926k", title: "R$ 925.740" }
 *
 * Locale: pt-BR (comma decimal, dot thousand). Threshold: k>=1000, M>=1_000_000, B>=1_000_000_000.
 * Negatives keep sign before "R$" ("-R$ 500k"). Zero renders as "R$ 0" (never "R$ 0k").
 * null / undefined / NaN → opts.fallback ("—" by default).
 */

export type FmtMoneyMode = "exact" | "short" | "shortWithTooltip";

export interface FmtMoneyOptions {
  /** Number of decimals (mode='exact' only). Default 0. */
  decimals?: number;
  /** Remove the "R$ " prefix. Works for both 'exact' and 'short'. Default false. */
  hideSymbol?: boolean;
  /** Returned when value is null/undefined/NaN. Default "—". */
  fallback?: string;
}

export interface FmtMoneyTooltip {
  display: string;
  title: string;
}

function isNully(v: number | null | undefined): v is null | undefined {
  return v === null || v === undefined || Number.isNaN(v);
}

function formatExact(absValue: number, decimals: number): string {
  return absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatShort(absValue: number): string {
  if (absValue >= 1_000_000_000) {
    return `${(absValue / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  }
  if (absValue >= 1_000_000) {
    return `${(absValue / 1_000_000).toFixed(1).replace(".", ",")}M`;
  }
  if (absValue >= 1_000) {
    return `${Math.round(absValue / 1_000)}k`;
  }
  // sub-1k falls back to exact integer (no "k" suffix)
  return formatExact(Math.round(absValue), 0);
}

function withSymbol(body: string, hideSymbol: boolean, negative: boolean): string {
  const prefix = hideSymbol ? "" : "R$ ";
  const sign = negative ? "-" : "";
  return `${sign}${prefix}${body}`;
}

export function fmtMoney(
  value: number | null | undefined,
  mode: "exact" | "short",
  opts?: FmtMoneyOptions,
): string;
export function fmtMoney(
  value: number | null | undefined,
  mode: "shortWithTooltip",
  opts?: FmtMoneyOptions,
): FmtMoneyTooltip;
export function fmtMoney(
  value: number | null | undefined,
  mode: FmtMoneyMode = "exact",
  opts: FmtMoneyOptions = {},
): string | FmtMoneyTooltip {
  const { decimals = 0, hideSymbol = false, fallback = "—" } = opts;

  if (isNully(value)) {
    return mode === "shortWithTooltip" ? { display: fallback, title: fallback } : fallback;
  }

  const negative = value < 0;
  const abs = Math.abs(value);

  if (mode === "exact") {
    return withSymbol(formatExact(abs, decimals), hideSymbol, negative);
  }

  if (mode === "short") {
    return withSymbol(formatShort(abs), hideSymbol, negative);
  }

  // shortWithTooltip
  return {
    display: withSymbol(formatShort(abs), hideSymbol, negative),
    title: withSymbol(formatExact(abs, 0), hideSymbol, negative),
  };
}

/**
 * Parse a user-typed BRL string ("R$ 250.000,50", "250000", "1,5") into a number.
 * Treats "." as thousand separator and "," as decimal (pt-BR). Returns 0 for empty/invalid.
 */
export function parseMoney(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Format a number for editing inside an input: "R$ 250.000" (no decimals unless present). */
export function formatMoneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "";
  return fmtMoney(value, "exact");
}
