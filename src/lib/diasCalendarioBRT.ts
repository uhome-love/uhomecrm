/** Data YYYY-MM-DD no horário de Brasília. */
export function dataBRT(d: Date | string): string {
  const x = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00-03:00` : d) : d;
  return x.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
/** Dias de calendário (BRT) entre a data e hoje: positivo = passado. Sem arredondar horas. */
export function diasCalendarioBRT(data: Date | string, agora: Date = new Date()): number {
  const a = Date.parse(`${dataBRT(data)}T00:00:00Z`);
  const b = Date.parse(`${dataBRT(agora)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
