// ─────────────────────────────────────────────────────────────────
// leadHelpers — utilitários compartilhados do drawer de lead
// ─────────────────────────────────────────────────────────────────
import { parseDateBRTSafe } from "@/lib/utils";

/** "Kizye Anacleto" → "KA"; "Maria" → "MA"; "" → "?" */
export function getInitials(nome: string | null | undefined): string {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return (first + last).toUpperCase();
}

const WEEKDAYS_BRT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS_BRT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function toBRTDateOnly(d: Date): { y: number; m: number; day: number; weekday: number; } {
  // converte UTC → BRT (-03)
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: brt.getUTCFullYear(),
    m: brt.getUTCMonth(),
    day: brt.getUTCDate(),
    weekday: brt.getUTCDay(),
  };
}

/**
 * "HOJE" / "ONTEM" / "Quarta-feira" (2-6 dias) / "22 DE MAIO" (mais antigo).
 */
export function formatDayHeader(iso: string | Date | null | undefined): string {
  const d = typeof iso === "string" ? parseDateBRTSafe(iso) : (iso ?? null);
  if (!d) return "";
  const today = toBRTDateOnly(new Date());
  const target = toBRTDateOnly(d);
  const todayMid = Date.UTC(today.y, today.m, today.day);
  const targetMid = Date.UTC(target.y, target.m, target.day);
  const diffDays = Math.round((todayMid - targetMid) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "HOJE";
  if (diffDays === 1) return "ONTEM";
  if (diffDays >= 2 && diffDays <= 6) return WEEKDAYS_BRT[target.weekday];
  return `${String(target.day).padStart(2, "0")} DE ${MONTHS_BRT[target.m]}`;
}

/** Chave estável de dia BRT (YYYY-MM-DD) para agrupar eventos. */
export function dayKeyBRT(iso: string | Date | null | undefined): string {
  const d = typeof iso === "string" ? parseDateBRTSafe(iso) : (iso ?? null);
  if (!d) return "unknown";
  const t = toBRTDateOnly(d);
  return `${t.y}-${String(t.m + 1).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}
