/**
 * useKPIs — React hook for the official metrics layer
 * 
 * Usage:
 *   const { kpis, isLoading } = useMyKPIs("mes");
 *   const { teamKPIs, isLoading } = useTeamKPIs("semana");
 *   const { rankings, isLoading } = useRankings("mes");
 */

import { useQuery } from "@tanstack/react-query";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  fetchKPIsByPeriod,
  fetchMyKPIs,
  fetchTeamKPIs,
  calculateRankingScores,
  type CorretorKPIs,
  type RankingScore,
} from "@/lib/metricsService";
import { getMetricPeriodRange } from "@/lib/metricDefinitions";

/**
 * Fetch KPIs for the current logged-in user
 */
export function useMyKPIs(
  period: string = "mes",
  customStart?: string,
  customEnd?: string
) {
  const { authUserId } = useAuthUser();

  return useQuery({
    queryKey: ["my-kpis", authUserId, period, customStart, customEnd],
    queryFn: () => fetchMyKPIs(authUserId!, period, customStart, customEnd),
    enabled: !!authUserId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch KPIs for all corretores (used by CEO/admin views)
 */
export function useAllKPIs(
  period: string = "mes",
  customStart?: string,
  customEnd?: string
) {
  return useQuery({
    queryKey: ["all-kpis", period, customStart, customEnd],
    queryFn: () => fetchKPIsByPeriod(period, undefined, customStart, customEnd),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch KPIs for a manager's team
 */
export function useTeamKPIs(
  period: string = "mes",
  customStart?: string,
  customEnd?: string
) {
  const { authUserId } = useAuthUser();
  const range = getMetricPeriodRange(period, customStart, customEnd);

  return useQuery({
    queryKey: ["team-kpis", authUserId, period, customStart, customEnd],
    queryFn: () => fetchTeamKPIs(authUserId!, range),
    enabled: !!authUserId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch rankings with scores for all corretores
 */
export function useRankings(
  period: string = "mes",
  customStart?: string,
  customEnd?: string
) {
  const allKPIsQuery = useAllKPIs(period, customStart, customEnd);

  const rankings: RankingScore[] = allKPIsQuery.data
    ? calculateRankingScores(allKPIsQuery.data)
    : [];

  return {
    rankings,
    isLoading: allKPIsQuery.isLoading,
    error: allKPIsQuery.error,
    refetch: allKPIsQuery.refetch,
  };
}

/**
 * Fetch KPIs for a specific user (used by manager viewing a broker)
 */
export function useCorretorKPIs(
  corretorAuthUserId: string | null,
  period: string = "mes",
  customStart?: string,
  customEnd?: string
) {
  return useQuery({
    queryKey: ["corretor-kpis", corretorAuthUserId, period, customStart, customEnd],
    queryFn: () =>
      fetchMyKPIs(corretorAuthUserId!, period, customStart, customEnd),
    enabled: !!corretorAuthUserId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
