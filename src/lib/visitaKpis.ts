// Definição CANÔNICA dos KPIs de visita — fonte única de verdade.
// Espelha a view visitas_unicas + a RPC public.get_visitas_kpis:
//   • 1 visita por (lead OU cliente) por data_visita, mantendo o MELHOR status;
//   • ignora canceladas e origem backfill_*;
//   • buckets MUTUAMENTE EXCLUSIVOS: Total = A realizar + Realizadas + No show.
// IMPORTANTE: se mudar aqui, mudar também na RPC get_visitas_kpis (andam juntas).

const STATUS_RANK: Record<string, number> = {
  realizada: 6, confirmada: 5, marcada: 4, reagendada: 3, no_show: 2, cancelada: 1,
};
const A_REALIZAR = ["marcada", "confirmada", "reagendada"];

export interface VisitaKpiRow {
  pipeline_lead_id?: string | null;
  nome_cliente?: string | null;
  data_visita?: string | null;
  status?: string | null;
  origem?: string | null;
}

export interface VisitaKpis {
  total: number;
  aRealizar: number;
  realizadas: number;
  noShow: number;
}

/** Deduplica (1 por cliente/dia, melhor status) e conta os baldes canônicos. */
export function bucketVisitasCanonico(rows: VisitaKpiRow[]): VisitaKpis {
  const best = new Map<string, string>();
  for (const r of rows) {
    if ((r.origem || "").startsWith("backfill_")) continue;
    const st = (r.status || "").toLowerCase();
    if (!st || st === "cancelada") continue;
    const chave = `${r.pipeline_lead_id || (r.nome_cliente || "").trim().toLowerCase()}|${r.data_visita || ""}`;
    const atual = best.get(chave);
    if (!atual || (STATUS_RANK[st] || 0) > (STATUS_RANK[atual] || 0)) best.set(chave, st);
  }
  let realizadas = 0, noShow = 0, aRealizar = 0;
  for (const st of best.values()) {
    if (st === "realizada") realizadas++;
    else if (st === "no_show") noShow++;
    else if (A_REALIZAR.includes(st)) aRealizar++;
  }
  return { total: realizadas + noShow + aRealizar, aRealizar, realizadas, noShow };
}
