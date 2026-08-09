// =============================================================================
// useFunilEtapas — funil de 6 etapas do pipeline (coorte × período) + visitas.
// Wrapper da RPC public.get_relatorio_funil, no MESMO escopo por papel da
// página Performance (empresa / equipe / corretor).
// =============================================================================
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunilEtapasFiltro {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  /** null = empresa (admin/diretor); id do gestor = equipe; id do corretor = só ele. */
  gestorId: string | null;
}

export function useFunilEtapas(
  f: FunilEtapasFiltro,
  enabled = true
): UseQueryResult<Record<string, unknown>> {
  return useQuery({
    queryKey: ["funil-etapas", f.start, f.end, f.gestorId],
    enabled,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase.rpc("get_relatorio_funil" as never, {
        p_gestor_id: f.gestorId,
        p_start: f.start,
        p_end: f.end,
        p_prev_start: f.prevStart,
        p_prev_end: f.prevEnd,
      } as never);
      if (error) throw error;
      return (data as Record<string, unknown>) ?? {};
    },
  });
}
