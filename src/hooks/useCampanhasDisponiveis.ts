/**
 * useCampanhasDisponiveis — regra única de "quais campanhas o corretor pode ligar agora".
 *
 * Filtra as listas de Oferta Ativa por:
 *  - status liberada
 *  - não expirada (expira_em)
 *  - escopo (equipes/corretores) — vazio = disponível para todos
 *
 * Também devolve as estatísticas (na fila / aproveitados / total) via get_batch_lista_stats.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOAListas, type OALista } from "@/hooks/useOfertaAtiva";

export interface ListaStats {
  naFila: number;
  aproveitados: number;
  total: number;
  pct: number;
  meusTentativas: number;
}

/** Gerentes (equipes) a que o usuário pertence — usado no escopo da campanha. */
export function useMinhasEquipes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["oa-minhas-equipes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("status", "ativo")
        .eq("user_id", user!.id);
      return (data ?? []).map((r: { gerente_id: string }) => r.gerente_id).filter(Boolean) as string[];
    },
    staleTime: 10 * 60_000,
  });
}

export function useBatchListaStats(listaIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["oa-listas-batch-stats", listaIds.join(","), user?.id],
    queryFn: async () => {
      if (!listaIds.length || !user) return {} as Record<string, ListaStats>;

      const { data, error } = await supabase.rpc("get_batch_lista_stats", {
        p_lista_ids: listaIds,
        p_corretor_id: user.id,
      });

      if (error) {
        console.error("get_batch_lista_stats error:", error);
        return {} as Record<string, ListaStats>;
      }

      const raw = (data || {}) as Record<string, any>;
      const statsMap: Record<string, ListaStats> = {};
      for (const [lid, val] of Object.entries(raw)) {
        statsMap[lid] = {
          naFila: val.naFila ?? 0,
          aproveitados: val.aproveitados ?? 0,
          total: val.total ?? 0,
          pct: val.pct ?? 0,
          meusTentativas: val.meusTentativas ?? 0,
        };
      }
      return statsMap;
    },
    staleTime: 60_000,
    enabled: listaIds.length > 0 && !!user,
  });
}

export function useCampanhasDisponiveis() {
  const { user } = useAuth();
  const { listas, isLoading } = useOAListas();
  const { data: minhasEquipes } = useMinhasEquipes();

  const campanhas: OALista[] = useMemo(() => {
    return listas.filter((l) => {
      if (l.status !== "liberada") return false;
      if (l.expira_em && new Date(l.expira_em).getTime() <= Date.now()) return false;
      const esc = l.escopo ?? {};
      const equipes = esc.equipes ?? [];
      const corretores = esc.corretores ?? [];
      if (equipes.length === 0 && corretores.length === 0) return true;
      if (user && corretores.includes(user.id)) return true;
      return (minhasEquipes ?? []).some((g) => equipes.includes(g));
    });
  }, [listas, minhasEquipes, user]);

  const ids = useMemo(() => campanhas.map((c) => c.id), [campanhas]);
  const { data: statsMap } = useBatchListaStats(ids);

  // Ordena por leads na fila (desc) — a campanha "do momento" fica em destaque
  const ordenadas = useMemo(() => {
    return [...campanhas].sort(
      (a, b) => (statsMap?.[b.id]?.naFila ?? 0) - (statsMap?.[a.id]?.naFila ?? 0),
    );
  }, [campanhas, statsMap]);

  return {
    campanhas: ordenadas,
    statsMap: statsMap ?? {},
    isLoading,
  };
}
