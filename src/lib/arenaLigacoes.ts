/** Regras puras da Arena de Ligações (Oferta Ativa). */

/** Mínimo diário definido pela direção: 30 ligações · 3 aproveitados · 1 visita agendada. */
export const ARENA_MINIMO = { ligacoes: 30, aproveitados: 3, visitas: 1 } as const;

export interface PlacarDia { ligacoes: number; aproveitados: number; visitas: number }

export const pct = (v: number, meta: number) => (meta <= 0 ? 100 : Math.min(100, Math.round((v / meta) * 100)));

/** Progresso geral do dia (média das três metas) e o que falta em cada uma. */
export function progressoDia(p: PlacarDia, m: PlacarDia = ARENA_MINIMO) {
  const faltam = {
    ligacoes: Math.max(0, m.ligacoes - p.ligacoes),
    aproveitados: Math.max(0, m.aproveitados - p.aproveitados),
    visitas: Math.max(0, m.visitas - p.visitas),
  };
  const geral = Math.round((pct(p.ligacoes, m.ligacoes) + pct(p.aproveitados, m.aproveitados) + pct(p.visitas, m.visitas)) / 3);
  const completo = faltam.ligacoes === 0 && faltam.aproveitados === 0 && faltam.visitas === 0;
  return { faltam, geral, completo };
}

/** Frase curta de incentivo conforme o número de ligações do dia. */
export function fraseIncentivo(ligacoes: number, meta = ARENA_MINIMO.ligacoes): string {
  if (ligacoes === 0) return "A primeira ligação é a mais difícil. Bora quebrar o gelo! ☕";
  if (ligacoes < 10) return "Aquecendo os motores 🔥 Cada ligação é uma chance de visita.";
  if (ligacoes < meta / 2) return "Ritmo bom! Continua que a visita vem 💪";
  if (ligacoes < meta) return `Faltam só ${meta - ligacoes} para o mínimo. Reta final! 🚀`;
  return "Mínimo batido! Agora é ir pro topo do ranking 🏆";
}

/** Fora da Roleta = nem a semana passada nem a atual atingiram o mínimo de visitas. */
export function foraDaRoleta(semanaAnterior: number, semanaAtual: number, meta: number) {
  return !(semanaAnterior >= meta || semanaAtual >= meta);
}

/** Marcos que disparam comemoração quando são cruzados entre dois placares. */
export function marcosCruzados(antes: PlacarDia, depois: PlacarDia, m: PlacarDia = ARENA_MINIMO): string[] {
  const out: string[] = [];
  if (antes.ligacoes < m.ligacoes && depois.ligacoes >= m.ligacoes) out.push(`${m.ligacoes} ligações! Mínimo do dia batido 🎯`);
  if (antes.aproveitados < m.aproveitados && depois.aproveitados >= m.aproveitados) out.push(`${m.aproveitados} aproveitados! Que fase 🤝`);
  if (depois.visitas > antes.visitas) out.push("Visita marcada! É assim que se volta pra Roleta 🏠");
  return out;
}
