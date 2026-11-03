import type { TimeAgregadoRow } from "@/hooks/useTimeAgregado";

/** Describes exactly the rows displayed, without reclassifying server counts. */
export function modoTimeContext(rows: Pick<TimeAgregadoRow, "total_leads">[], own: boolean): string {
  const total = rows.reduce((sum, row) => sum + row.total_leads, 0);
  return `${own ? "Meus leads" : "Time"} · ${total.toLocaleString("pt-BR")} no resumo`;
}