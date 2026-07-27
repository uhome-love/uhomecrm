import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PerfRankingItem, PerfDiagnosticoItem } from "./usePerformance";

/**
 * Ponte temporária: enquanto a RPC nova não aceita p_escopo (chega amanhã),
 * quando um admin escolhe uma equipe específica filtramos client-side pelo
 * conjunto de auth_user_id daquele gestor via team_members.
 */
export function useEquipeUserIds(equipeId?: string) {
  return useQuery({
    queryKey: ["equipe-user-ids", equipeId],
    enabled: !!equipeId,
    queryFn: async (): Promise<Set<string>> => {
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("status", "ativo")
        .eq("gerente_id", equipeId!);
      return new Set((data || []).map((r) => r.user_id).filter(Boolean) as string[]);
    },
    staleTime: 5 * 60_000,
  });
}

export function applyEquipeFilter<T extends { auth_user_id: string }>(
  rows: T[] | undefined,
  ids: Set<string> | undefined,
): T[] {
  if (!rows) return [];
  if (!ids) return rows;
  return rows.filter((r) => ids.has(r.auth_user_id));
}

/** Filtra também o diagnóstico (que traz profile_id, não auth_user_id). */
export function applyEquipeFilterDiagnostico(
  rows: PerfDiagnosticoItem[] | undefined,
  ranking: PerfRankingItem[] | undefined,
  ids: Set<string> | undefined,
): PerfDiagnosticoItem[] {
  if (!rows) return [];
  if (!ids || !ranking) return rows;
  const allowedProfileIds = new Set(
    ranking.filter((r) => ids.has(r.auth_user_id)).map((r) => r.profile_id),
  );
  return rows.filter((r) => allowedProfileIds.has(r.profile_id));
}
