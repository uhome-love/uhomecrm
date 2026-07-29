/**
 * useMetricasSSOT — hook único de métricas (Fonte Única de Verdade).
 * Consome rpc_metricas via src/lib/metricasSSOT.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchMetricas, somarMetricas, agruparPorEquipe, type MetricasFiltro } from "@/lib/metricasSSOT";

export function useMetricasSSOT(filtro: MetricasFiltro, enabled = true) {
  const query = useQuery({
    queryKey: ["metricas-ssot", filtro.start, filtro.end, filtro.userId ?? null, filtro.gerenteId ?? null, filtro.incluirInativos ?? true],
    queryFn: () => fetchMetricas(filtro),
    enabled: enabled && Boolean(filtro.start && filtro.end),
    staleTime: 60_000,
  });

  const linhas = query.data ?? [];

  return {
    ...query,
    linhas,
    totais: somarMetricas(linhas),
    equipes: agruparPorEquipe(linhas),
  };
}
