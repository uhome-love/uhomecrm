/**
 * Visitas válidas da Roleta podem ter meia visita (parceria = 0,5 para cada corretor).
 * Formata no padrão brasileiro: 2 → "2", 1.5 → "1,5".
 */
export function fmtVisitas(v: number | string | null | undefined): string {
  const n = Math.round(Number(v ?? 0) * 10) / 10;
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/** Peso de uma visita realizada na contagem da Roleta. */
export function pesoVisita(temParceriaComOutroCorretor: boolean): number {
  return temParceriaComOutroCorretor ? 0.5 : 1;
}

/** Soma por cliente: mesmo cliente na semana conta uma vez (maior peso). */
export function somarVisitasPorCliente(visitas: { cliente: string; parceria: boolean }[]): number {
  const porCliente = new Map<string, number>();
  for (const v of visitas) {
    porCliente.set(v.cliente, Math.max(porCliente.get(v.cliente) ?? 0, pesoVisita(v.parceria)));
  }
  let total = 0;
  porCliente.forEach((p) => { total += p; });
  return total;
}
