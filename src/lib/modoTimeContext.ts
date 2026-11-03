import type { TimeAgregadoRow } from "@/hooks/useTimeAgregado";

/** Sums only displayed rows, without reclassifying server counts. */
export function totalModoTime(rows: Pick<TimeAgregadoRow, "total_leads">[]): number {
  return rows.reduce((sum, row) => sum + row.total_leads, 0);
}

export function modoTimeContext(rows: Pick<TimeAgregadoRow, "total_leads">[], own: boolean): string {
  const total = totalModoTime(rows);
  return `${own ? "Meus leads" : "Time"} · ${total.toLocaleString("pt-BR")} no resumo`;
}