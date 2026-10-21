/** Nova data (yyyy-MM-dd) ao adiar uma tarefa: conta a partir de hoje (BRT). */
export function dataAdiada(hoje: string, dias: number): string {
  const [y, m, d] = hoje.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}
