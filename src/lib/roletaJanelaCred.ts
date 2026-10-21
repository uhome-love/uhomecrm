// Horário (BRT) em que cada turno da Roleta aceita pedido de credenciamento.
const JANELAS: Record<string, { ini: number; fim: number; fimLabel: string; nome: string }> = {
  manha: { ini: 7 * 60, fim: 9 * 60 + 30, fimLabel: "09:30", nome: "da manhã" },
  tarde: { ini: 12 * 60, fim: 13 * 60 + 30, fimLabel: "13:30", nome: "da tarde" },
  noturna: { ini: 18 * 60, fim: 21 * 60 + 30, fimLabel: "21:30", nome: "da noturna" },
  dia_todo: { ini: 8 * 60, fim: 23 * 60 + 30, fimLabel: "23:30", nome: "do dia" },
};

function minutosBRT(d: Date): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function pedidoDentroDaJanela(janela: string, quando: Date): boolean {
  const j = JANELAS[janela];
  if (!j) return true;
  const m = minutosBRT(quando);
  return m >= j.ini && m < j.fim;
}

export function mensagemJanelaFechada(janela: string): string {
  const j = JANELAS[janela];
  return j ? `O credenciamento ${j.nome} fecha às ${j.fimLabel}.` : "Credenciamento fora do horário.";
}
