/**
 * perfPeriodo.ts — cálculo de janelas de período da Central de Performance (BRT).
 *
 * Todos os períodos são resolvidos em datas YYYY-MM-DD (sem hora), que é o
 * contrato de `rpc_metricas` / `rpc_metricas_origem` (já normalizadas em BRT).
 */
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  isSameMonth,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type PeriodoTipo = "mes" | "trimestre" | "ano" | "d90" | "custom";

export interface PeriodoState {
  tipo: PeriodoTipo;
  /** deslocamento em unidades do tipo (0 = atual, -1 = anterior). Ignorado em d90/custom. */
  offset: number;
  /** usado apenas quando tipo === "custom" */
  customStart?: string;
  customEnd?: string;
}

export interface PeriodoResolvido {
  start: string;
  end: string;
  label: string;
  /** janela imediatamente anterior de mesmo tamanho — base do comparativo */
  prevStart: string;
  prevEnd: string;
  prevLabel: string;
  /** data usada como referência mensal (metas, evolução) */
  referencia: Date;
  /** navegação por setas faz sentido? (custom/90d não) */
  navegavel: boolean;
  /** já está no período mais recente */
  noPresente: boolean;
}

const d = (x: Date) => format(x, "yyyy-MM-dd");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const PERIODO_OPCOES: { tipo: PeriodoTipo; label: string }[] = [
  { tipo: "mes", label: "Mês" },
  { tipo: "trimestre", label: "Trimestre" },
  { tipo: "ano", label: "Ano" },
  { tipo: "d90", label: "90 dias" },
  { tipo: "custom", label: "Personalizado" },
];

export function resolverPeriodo(estado: PeriodoState, hoje = new Date()): PeriodoResolvido {
  const { tipo, offset } = estado;

  if (tipo === "custom") {
    const start = estado.customStart || d(startOfMonth(hoje));
    const end = estado.customEnd || d(hoje);
    const dias = Math.max(1, differenceInCalendarDays(new Date(end), new Date(start)) + 1);
    const prevEnd = d(addDays(new Date(start), -1));
    const prevStart = d(addDays(new Date(start), -dias));
    return {
      start,
      end,
      label: `${format(new Date(start), "dd/MM/yy")} – ${format(new Date(end), "dd/MM/yy")}`,
      prevStart,
      prevEnd,
      prevLabel: `${dias} dias anteriores`,
      referencia: new Date(end),
      navegavel: false,
      noPresente: true,
    };
  }

  if (tipo === "d90") {
    const end = hoje;
    const start = addDays(hoje, -89);
    return {
      start: d(start),
      end: d(end),
      label: "Últimos 90 dias",
      prevStart: d(addDays(start, -90)),
      prevEnd: d(addDays(start, -1)),
      prevLabel: "90 dias anteriores",
      referencia: end,
      navegavel: false,
      noPresente: true,
    };
  }

  if (tipo === "trimestre") {
    const ref = addQuarters(hoje, offset);
    const start = startOfQuarter(ref);
    const end = endOfQuarter(ref);
    const prev = addQuarters(ref, -1);
    return {
      start: d(start),
      end: d(end),
      label: `${format(start, "QQQ", { locale: ptBR })} de ${format(start, "yyyy")}`,
      prevStart: d(startOfQuarter(prev)),
      prevEnd: d(endOfQuarter(prev)),
      prevLabel: "trimestre anterior",
      referencia: end,
      navegavel: true,
      noPresente: offset >= 0,
    };
  }

  if (tipo === "ano") {
    const ref = addYears(hoje, offset);
    const start = startOfYear(ref);
    const end = endOfYear(ref);
    const prev = addYears(ref, -1);
    return {
      start: d(start),
      end: d(end),
      label: format(start, "yyyy"),
      prevStart: d(startOfYear(prev)),
      prevEnd: d(endOfYear(prev)),
      prevLabel: "ano anterior",
      referencia: end,
      navegavel: true,
      noPresente: offset >= 0,
    };
  }

  // mês
  const ref = addMonths(hoje, offset);
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const prev = addMonths(ref, -1);
  const base = cap(format(start, "MMMM 'de' yyyy", { locale: ptBR }));
  return {
    start: d(start),
    end: d(end),
    label: isSameMonth(ref, hoje) ? `${base} · mês atual` : base,
    prevStart: d(startOfMonth(prev)),
    prevEnd: d(endOfMonth(prev)),
    prevLabel: "mês anterior",
    referencia: end,
    navegavel: true,
    noPresente: offset >= 0,
  };
}

/** variação percentual entre atual e anterior; null quando não há base de comparação */
export function delta(atual: number, anterior: number): number | null {
  if (!anterior || anterior <= 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function fmtDelta(v: number | null, sufixo: string): string | undefined {
  if (v === null) return undefined;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}% vs ${sufixo}`;
}
