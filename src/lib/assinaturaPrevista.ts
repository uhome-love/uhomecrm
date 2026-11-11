const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-11-11" → "hoje" / "amanhã" / "14 nov" (dias de calendário em BRT). */
export function assinaturaPrevistaRotulo(iso: string | null | undefined, agora: Date = new Date()): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  const diff = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `${String(d).padStart(2, "0")} ${MESES[m - 1]}`;
}
