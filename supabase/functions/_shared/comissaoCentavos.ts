/** Cumulative cent allocation conserves the total, including the final cent. */
export function repartirCentavos(total: number, pesos: readonly number[]): number[] {
  const cents = Math.round((total + Number.EPSILON) * 100);
  const soma = pesos.reduce((s, p) => s + p, 0);
  let acumulado = 0, anterior = 0;
  return pesos.map((p, i) => {
    acumulado += p;
    const atual = soma > 0 ? (i === pesos.length - 1 ? cents : Math.round(cents * acumulado / soma)) : 0;
    const valor = (atual - anterior) / 100;
    anterior = atual;
    return valor;
  });
}