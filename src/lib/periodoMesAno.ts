/** mes 1-12 = aquele mês; mes 0 = ano inteiro. Datas yyyy-MM-dd (calendário BRT, sem fuso). */
export function periodoMesAno(ano: number, mes: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (!mes) return { start: `${ano}-01-01`, end: `${ano}-12-31` };
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { start: `${ano}-${pad(mes)}-01`, end: `${ano}-${pad(mes)}-${pad(ultimo)}` };
}
