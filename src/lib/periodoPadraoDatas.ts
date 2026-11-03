import type { PeriodoPadrao } from "@/components/ui/PeriodSelector";

const somaDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
const diaSemana = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};

/** Datas (yyyy-MM-dd, BRT) de cada atalho de período, a partir do dia de hoje. */
export function datasDoPeriodo(p: Exclude<PeriodoPadrao, "personalizado">, hoje: string): { inicio: string; fim: string } {
  switch (p) {
    case "hoje": return { inicio: hoje, fim: hoje };
    case "ontem": { const o = somaDias(hoje, -1); return { inicio: o, fim: o }; }
    case "semana": return { inicio: somaDias(hoje, -((diaSemana(hoje) + 6) % 7)), fim: hoje };
    case "mes": return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
    case "30d": return { inicio: somaDias(hoje, -29), fim: hoje };
  }
}

/** Qual atalho corresponde ao intervalo; "personalizado" se nenhum. */
export function periodoAtivo(inicio: string, fim: string, hoje: string): PeriodoPadrao {
  for (const p of ["hoje", "ontem", "semana", "mes", "30d"] as const) {
    const x = datasDoPeriodo(p, hoje);
    if (x.inicio === inicio && x.fim === fim) return p;
  }
  return "personalizado";
}
