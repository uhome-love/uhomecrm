import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmEstado = "calculado" | "sem_carteira" | "dados_insuficientes" | "erro";

export interface RoletaPerformanceStatus {
  crm: { estado: CrmEstado; pct: number | null; a_atualizar?: number; em_dia?: number; ambar?: number; vermelho?: number; ativos?: number };
  crm_minimo_pct: number;
  crm_gate_ativo: boolean;
  visitas_gate_ativo: boolean;
  crm_atende: boolean;
  bloqueado: boolean;
}

/** Status do Uhome Performance (CRM mínimo) do usuário logado — fonte única no banco. */
export function useRoletaPerformanceStatus() {
  return useQuery({
    queryKey: ["roleta-performance-status"],
    queryFn: async (): Promise<RoletaPerformanceStatus | null> => {
      const { data, error } = await supabase.rpc("roleta_performance_status");
      if (error) throw error;
      const d = data as unknown as RoletaPerformanceStatus | null;
      return d && d.crm ? d : null;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
