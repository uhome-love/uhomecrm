import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayBRT } from "@/lib/brtTime";

/** Contadores pessoais do menu: tarefas pendentes que vencem hoje ou já venceram, e visitas marcadas para hoje. */
export function useMenuContadores(userId?: string) {
  return useQuery({
    queryKey: ["menu-contadores", userId, todayBRT()],
    enabled: !!userId,
    staleTime: 120_000,
    refetchInterval: 300_000,
    queryFn: async () => {
      const hoje = todayBRT();
      const [t, v] = await Promise.all([
        supabase.from("pipeline_tarefas").select("id", { count: "exact", head: true })
          .eq("responsavel_id", userId!).eq("status", "pendente").lte("vence_em", hoje),
        supabase.from("visitas").select("id", { count: "exact", head: true })
          .eq("corretor_id", userId!).eq("data_visita", hoje).in("status", ["marcada", "confirmada", "reagendada"]),
      ]);
      return { tarefas: t.count ?? 0, visitas: v.count ?? 0 };
    },
  });
}
