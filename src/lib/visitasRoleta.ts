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

/** Início da semana (segunda) de uma data YYYY-MM-DD. */
function semanaDe(data: string): string {
  const d = new Date(data + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

/**
 * IDs de visitas realizadas que repetem o mesmo cliente do mesmo corretor na semana
 * (seg–dom). A primeira conta para a Roleta; as seguintes não.
 */
export function idsVisitasRepetidas(
  visitas: { id: string; status: string; data_visita: string; hora_visita?: string | null; corretor_id?: string | null; cliente: string }[],
): Set<string> {
  const ordenadas = visitas
    .filter((v) => v.status === "realizada" && v.cliente)
    .sort((a, b) => (a.data_visita + (a.hora_visita ?? "")).localeCompare(b.data_visita + (b.hora_visita ?? "")));
  const vistos = new Set<string>();
  const repetidas = new Set<string>();
  for (const v of ordenadas) {
    const k = `${v.corretor_id ?? ""}|${semanaDe(v.data_visita)}|${v.cliente}`;
    if (vistos.has(k)) repetidas.add(v.id); else vistos.add(k);
  }
  return repetidas;
}
