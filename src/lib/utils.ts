import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Safely parses a "YYYY-MM-DD" date string as noon local time,
 * avoiding the UTC midnight pitfall where isToday/isTomorrow would be off by 1 day in BRT.
 * For full ISO strings (with T), returns normal Date parse.
 */
export function parseDateBRT(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T")) return new Date(dateStr);
  // "YYYY-MM-DD" → treat as noon to avoid timezone day shift
  return new Date(dateStr + "T12:00:00");
}
