import { CAMPANHA_FIM, TICKET_MEDIO, VISITAS_POR_VENDA } from "./config";

export const META_VGV_MINIMA = 1_000_000;
export const META_VISITAS_PADRAO = 3;
export const META_EQUIPE = 10_000_000;
export const META_UHOME = 100_000_000;

/** "R$ 1,5 mi" / "R$ 649 mil" — mesmo estilo dos KPIs da Minha Rotina. */
export const brlCurto = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v >= 1_000
      ? `R$ ${Math.round(v / 1_000)} mil`
      : `R$ ${Math.round(v)}`;

export const metaValida = (v: number) => Number.isFinite(v) && v >= META_VGV_MINIMA;

/** Visitas realizadas necessárias para um VGV, pela média da Uhome. */
export const visitasParaVgv = (vgv: number) => Math.max(0, Math.ceil((vgv / TICKET_MEDIO) * VISITAS_POR_VENDA));

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);
}

/** Ritmo até 18/12: visitas que faltam e por semana. */
export function ritmo(metaVgv: number, vgvAssinado: number, hoje: string) {
  const faltamVgv = Math.max(0, metaVgv - vgvAssinado);
  const visitas = visitasParaVgv(faltamVgv);
  const semanas = Math.max(1, Math.ceil((diasEntre(hoje, CAMPANHA_FIM) + 1) / 7));
  return { faltamVgv, visitas, porSemana: Math.ceil(visitas / semanas), semanas };
}

/** Segunda-feira da semana (YYYY-MM-DD). */
export function segundaDaSemana(hoje: string) {
  const d = new Date(hoje + "T12:00:00Z");
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}
