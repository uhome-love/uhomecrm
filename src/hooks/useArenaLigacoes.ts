import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LinhaRanking {
  user_id: string; nome: string; avatar_url: string | null;
  ligacoes: number; aproveitados: number; visitas: number; posicao: number;
}

/** Ranking de ligações (Oferta Ativa + Mutirão) — fonte única para Arena, painel e TV. */
export function useRankingLigacoes(periodo: "dia" | "semana") {
  return useQuery({
    queryKey: ["oa-ranking-ligacoes", periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("oa_ranking_ligacoes", { p_periodo: periodo });
      if (error) throw error;
      return (data ?? []) as LinhaRanking[];
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

/** Clientes esperando nas portas do Bolsão (mesma consulta da tela de Oferta Ativa). */
export function useTotalBolsao(porta: "estagnados" | "descartados") {
  return useQuery({
    queryKey: ["bolsao-contagens", porta],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bolsao_contagens", { p_porta: porta });
      if (error) throw error;
      return (data ?? []) as { empreendimento: string; total: number }[];
    },
    staleTime: 60_000,
    select: (rows) => rows.reduce((s, r) => s + Number(r.total), 0),
  });
}
