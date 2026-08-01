/**
 * useMetricasSSOT — hook único de métricas (Fonte Única de Verdade).
 * Consome rpc_metricas via src/lib/metricasSSOT.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchMetricas, somarMetricas, agruparPorEquipe, consolidarPorCorretor, type MetricasFiltro } from "@/lib/metricasSSOT";

export function useMetricasSSOT(filtro: MetricasFiltro, enabled = true) {
  const query = useQuery({
    queryKey: ["metricas-ssot", filtro.start, filtro.end, filtro.userId ?? null, filtro.gerenteId ?? null, filtro.incluirInativos ?? true],
    queryFn: () => fetchMetricas(filtro),
    enabled: enabled && Boolean(filtro.start && filtro.end),
    staleTime: 60_000,
  });

  /** linhas brutas: 1 por (corretor, equipe da época) */
  const rows = query.data ?? [];
  /** linhas de corretor consolidadas (equipe = equipe atual) */
  const linhas = consolidarPorCorretor(rows);

  return {
    ...query,
    linhas,
    rows,
    totais: somarMetricas(rows),
    /** ranking de equipes usa a equipe HISTÓRICA do fato */
    equipes: agruparPorEquipe(rows),
  };
}

