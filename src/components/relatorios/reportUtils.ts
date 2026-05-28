export interface ReportFilters {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  equipe: string;
  corretor: string;
  segmento: string;
}

export function getDateRange(f: ReportFilters): { startDate: Date; endDate: Date } {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  if (f.periodo === "hoje") {
    const s = new Date(brt); s.setHours(0, 0, 0, 0);
    const e = new Date(brt); e.setHours(23, 59, 59, 999);
    return { startDate: s, endDate: e };
  }
  if (f.periodo === "semana") {
    const day = brt.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const s = new Date(brt); s.setDate(brt.getDate() - diff); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
    return { startDate: s, endDate: e };
  }
  if (f.periodo === "custom" && f.dataInicio && f.dataFim) {
    const s = new Date(f.dataInicio + "T00:00:00");
    const e = new Date(f.dataFim + "T23:59:59");
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { startDate: s, endDate: e };
    }
  }
  // default: mes
  const s = new Date(brt.getFullYear(), brt.getMonth(), 1);
  const e = new Date(brt.getFullYear(), brt.getMonth() + 1, 0, 23, 59, 59);
  return { startDate: s, endDate: e };
}

export function getPeriodoAnterior(s: Date, e: Date): { startDate: Date; endDate: Date } {
  const diff = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { startDate: prevStart, endDate: prevEnd };
}

// `fmtMoney` removed (M5 cleanup). Import directly from `@/lib/fmtMoney`:
//   import { fmtMoney } from "@/lib/fmtMoney";
//   fmtMoney(v, "short")  // matches former local behavior (R$ 1,5M / R$ 925k)

export function fmtDate(d: string): string {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${String(dt.getDate()).padStart(2, "0")} ${months[dt.getMonth()]}`;
}
