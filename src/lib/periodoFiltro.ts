// =============================================================================
// periodoFiltro — régua ÚNICA de período dos relatórios (BRT).
//
// Todo relatório que oferece "mês atual / mês passado / 30-60-90 dias / ano /
// personalizado" deve usar estas funções, para que dois relatórios com o mesmo
// filtro leiam exatamente a mesma janela de datas.
//
// Convenção: { start, end } em 'YYYY-MM-DD', start INCLUSIVO e end EXCLUSIVO.
//
// Período anterior (comparação justa):
//  · mês/ano → mesma unidade de calendário deslocada 1 para trás, TRUNCADA no
//    mesmo número de dias já decorridos (dia 16 do mês compara com os 16
//    primeiros dias do mês passado, não com o mês passado inteiro);
//  · 30/60/90 dias → a janela imediatamente anterior, do mesmo tamanho.
// =============================================================================

export type PeriodoOpt =
  | "semana"
  | "semana_passada"
  | "mes"
  | "mes_passado"
  | "d30"
  | "d60"
  | "d90"
  | "ano"
  | "custom";

export interface Janela {
  start: string;
  end: string;
}

export const PERIODO_OPCOES: { value: PeriodoOpt; label: string }[] = [
  { value: "semana", label: "Semana atual" },
  { value: "semana_passada", label: "Semana anterior" },
  { value: "mes", label: "Mês (acumulado)" },
  { value: "custom", label: "Personalizado" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "d30", label: "Últimos 30 dias" },
  { value: "d60", label: "Últimos 60 dias" },
  { value: "d90", label: "Últimos 90 dias" },
  { value: "ano", label: "Ano inteiro" },
];


/** Hoje em BRT, no formato 'YYYY-MM-DD'. */
export function hojeBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function iso(y: number, m: number, d = 1): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Soma dias a uma data 'YYYY-MM-DD' (UTC puro, sem efeito de fuso). */
export function addDias(data: string, dias: number): string {
  const t = Date.parse(`${data}T00:00:00Z`) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas 'YYYY-MM-DD'. */
export function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Primeiro dia do mês N meses atrás (a partir do mês de `ref`). */
export function mesDeslocado(ref: string, delta: number): string {
  const [y, m] = ref.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return iso(Math.floor(total / 12), (total % 12) + 1);
}

/** Segunda-feira da semana de `data` ('YYYY-MM-DD'). */
export function segundaDaSemana(data: string): string {
  const dow = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDias(data, -((dow + 6) % 7));
}

/** Janela do filtro escolhido. `custom` usa as datas informadas (fim inclusivo na UI). */
export function calcJanela(opt: PeriodoOpt, custom?: { inicio: string; fim: string }): Janela {
  const hoje = hojeBRT();
  const [y, m] = hoje.split("-").map(Number);

  switch (opt) {
    case "semana": {
      // segunda-feira desta semana até hoje (acumulado da semana corrente)
      return { start: segundaDaSemana(hoje), end: addDias(hoje, 1) };
    }
    case "semana_passada": {
      const segAtual = segundaDaSemana(hoje);
      return { start: addDias(segAtual, -7), end: segAtual };
    }
    case "ano":
      return { start: iso(y, 1), end: iso(y + 1, 1) };
    case "mes_passado": {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return { start: iso(py, pm), end: iso(y, m) };
    }
    case "d30":
      return { start: addDias(hoje, -29), end: addDias(hoje, 1) };
    case "d60":
      return { start: addDias(hoje, -59), end: addDias(hoje, 1) };
    case "d90":
      return { start: addDias(hoje, -89), end: addDias(hoje, 1) };
    case "custom": {
      const inicio = custom?.inicio || iso(y, m);
      const fim = custom?.fim || hoje;
      return { start: inicio, end: addDias(fim, 1) };
    }
    case "mes":
    default:
      // acumulado do mês: dia 1º até hoje (inclusive)
      return { start: iso(y, m), end: addDias(hoje, 1) };
  }
}


/**
 * Janela anterior comparável. Trunca no mesmo número de dias já decorridos,
 * para não comparar meio mês com um mês fechado.
 */
export function calcJanelaAnterior(opt: PeriodoOpt, j: Janela): Janela {
  const hoje = hojeBRT();
  const fimReal = j.end < addDias(hoje, 1) ? j.end : addDias(hoje, 1);
  const dias = Math.max(1, diffDias(j.start, fimReal));

  if (opt === "ano") {
    const [y] = j.start.split("-").map(Number);
    const start = iso(y - 1, 1);
    return { start, end: addDias(start, dias) };
  }
  if (opt === "mes" || opt === "mes_passado") {
    const start = mesDeslocado(j.start, -1);
    return { start, end: addDias(start, dias) };
  }
  return { start: addDias(j.start, -dias), end: j.start };
}

/** Rótulo legível da janela, ex.: "01/08 a 16/08/2026". */
export function labelJanela(j: Janela): string {
  const fimInclusivo = addDias(j.end, -1);
  const br = (d: string) => d.split("-").reverse().join("/");
  const curto = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  return `${curto(j.start)} a ${br(fimInclusivo)}`;
}

/** Rótulo curto do filtro (usado no cabeçalho e no PDF). */
export function labelOpcao(opt: PeriodoOpt): string {
  return PERIODO_OPCOES.find((o) => o.value === opt)?.label ?? "Período";
}
