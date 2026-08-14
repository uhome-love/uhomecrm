// Definição CANÔNICA dos KPIs de visita — fonte única de verdade.
// Espelha a RPC public.get_visitas_kpis:
//   • CADA visita conta (sem deduplicar — um cliente pode visitar 2 empreendimentos
//     no mesmo dia = 2 visitas reais); só ignora canceladas e origem backfill_*;
//   • buckets MUTUAMENTE EXCLUSIVOS: Total = A realizar + Realizadas + No show.
// IMPORTANTE: se mudar aqui, mudar também na RPC get_visitas_kpis (andam juntas).

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

/** Conta os baldes canônicos (cada visita conta; exclui cancelada e backfill). */
export function bucketVisitasCanonico(rows: VisitaKpiRow[]): VisitaKpis {
  let realizadas = 0, noShow = 0, aRealizar = 0;
  for (const r of rows) {
    if ((r.origem || "").startsWith("backfill_")) continue;
    const st = (r.status || "").toLowerCase();
    if (!st || st === "cancelada") continue;
    if (st === "realizada") realizadas++;
    else if (st === "no_show") noShow++;
    else if (A_REALIZAR.includes(st)) aRealizar++;
  }
  return { total: realizadas + noShow + aRealizar, aRealizar, realizadas, noShow };
}
