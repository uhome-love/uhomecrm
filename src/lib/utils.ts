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
