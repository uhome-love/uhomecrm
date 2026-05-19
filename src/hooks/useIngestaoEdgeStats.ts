import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Periodo } from "./useIngestaoStats";

export interface EdgeStats {
  hours: number;
  counts_503: Record<string, number>;
  total_503: number;
  p95_latency_ms: number | null;
  note?: string;
}

function periodoToHours(p: Periodo): number {
  return p === "24h" ? 24 : p === "7d" ? 168 : 720;
}

export function useIngestaoEdgeStats(periodo: Periodo, paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "edge-stats", periodo],
    queryFn: async (): Promise<EdgeStats> => {
      const { data, error } = await supabase.functions.invoke("admin-ingestao-stats", {
        body: { hours: periodoToHours(periodo) },
      });
      if (error) throw error;
      return data as EdgeStats;
    },
    refetchInterval: paused ? false : 60_000,
    staleTime: 50_000,
    retry: 1,
  });
}
