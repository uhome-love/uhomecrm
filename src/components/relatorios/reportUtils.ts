import { formatBRT } from "@/lib/brtTime";

export interface ReportFilters {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  equipe: string;
  corretor: string;
  segmento: string;
}

export function getDateRange(f: ReportFilters): { startDate: Date; endDate: Date } {
  const dia = formatBRT(new Date(), "yyyy-MM-dd");
  const calendario = new Date(`${dia}T12:00:00Z`);
  const janela = (primeiro: string, ultimo: string) => ({
    startDate: new Date(`${primeiro}T00:00:00-03:00`),
    endDate: new Date(`${ultimo}T23:59:59.999-03:00`),
  });
  const dataUTC = (d: Date) => d.toISOString().slice(0, 10);

  if (f.periodo === "hoje") {
    return janela(dia, dia);
  }
  if (f.periodo === "semana") {
    const day = calendario.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const s = new Date(calendario); s.setUTCDate(s.getUTCDate() - diff);
    const e = new Date(s); e.setUTCDate(s.getUTCDate() + 6);
    return janela(dataUTC(s), dataUTC(e));
  }
  if (f.periodo === "custom" && f.dataInicio && f.dataFim) {
    const { startDate: s, endDate: e } = janela(f.dataInicio, f.dataFim);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { startDate: s, endDate: e };
    }
  }
  // default: mes
  const s = new Date(Date.UTC(calendario.getUTCFullYear(), calendario.getUTCMonth(), 1));
  const e = new Date(Date.UTC(calendario.getUTCFullYear(), calendario.getUTCMonth() + 1, 0));
  return janela(dataUTC(s), dataUTC(e));
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
