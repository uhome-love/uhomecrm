import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROUTE_PATTERNS, PUBLIC_ROUTES } from "@/lib/routePatterns";

export type UsoPeriodo = "7d" | "30d" | "90d";
export type UsoRole = "all" | "admin" | "gestor" | "corretor" | "backoffice" | "rh";

function sinceISO(p: UsoPeriodo): string {
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86400_000).toISOString();
}

export type StatsResult = {
  total_visits: number;
  sessions: number;
  unique_users: number;
  unknown_visits: number;
  unknown_pct: number;
  top_routes: Array<{ route_pattern: string; visits: number }>;
  role_distribution: Array<{ role: string; visits: number }>;
};

export type TableRow = {
  route_pattern: string;
  visits: number;
  unique_users: number;
  median_duration_ms: number | null;
  last_viewed: string;
};

export function useUsoPaginasStats(periodo: UsoPeriodo, role: UsoRole, paused: boolean) {
  return useQuery({
    queryKey: ["uso-paginas-stats", periodo, role],
    queryFn: async (): Promise<StatsResult> => {
      const { data, error } = await supabase.rpc("get_page_views_stats", {
        p_since: sinceISO(periodo),
        p_role: role === "all" ? null : role,
      });
      if (error) throw error;
      return data as unknown as StatsResult;
    },
    refetchInterval: paused ? false : 60_000,
    enabled: !paused,
  });
}

export function useUsoPaginasTable(periodo: UsoPeriodo, role: UsoRole, paused: boolean) {
  return useQuery({
    queryKey: ["uso-paginas-table", periodo, role],
    queryFn: async (): Promise<{
      rows: TableRow[];
      zeroAccess: string[];
    }> => {
      const { data, error } = await supabase.rpc("get_page_views_table", {
        p_since: sinceISO(periodo),
        p_role: role === "all" ? null : role,
      });
      if (error) throw error;
      const rows = (data ?? []) as TableRow[];
      const visited = new Set(rows.map((r) => r.route_pattern));
      const zeroAccess = ROUTE_PATTERNS
        .filter((p) => !PUBLIC_ROUTES.includes(p) && p !== "/_unknown" && !visited.has(p))
        .sort();
      return { rows, zeroAccess };
    },
    refetchInterval: paused ? false : 60_000,
    enabled: !paused,
  });
}
