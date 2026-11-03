/** Data de hoje em BRT (YYYY-MM-DD). */
export function hojeBRT(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Vendas novas desde a última visita, para comemorar. Primeira vez: só marca como vistas (sem enxurrada). */
export function vendasNovas(ids: string[], vistas: string[] | null): { novas: string[]; vistas: string[] } {
  if (vistas === null) return { novas: [], vistas: ids };
  const set = new Set(vistas);
  const novas = ids.filter((id) => !set.has(id));
  return { novas, vistas: [...vistas, ...novas].slice(-400) };
}
