/** Performance da Roleta ao vivo — fonte única: rpc_performance_roleta (mesmas regras da Minha Rotina). Escopo pelo servidor. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmSaude { pct: number | null; em_dia: number; ambar: number; vermelho: number; a_atualizar: number; estado?: string }
export interface Motivo { bloqueado: boolean; codigo: string; texto: string; titulo: string }
export interface CorretorPerf {
  user_id: string; nome: string; equipe: string; gerente_id: string | null;
  crm: CrmSaude; motivo: Motivo; visitas_semana_passada: number; visitas_semana_atual: number;
}

export function usePerformanceRoleta() {
  return useQuery({
    queryKey: ["performance-roleta"],
    staleTime: 60_000,
    queryFn: async (): Promise<CorretorPerf[]> => {
      const { data, error } = await supabase.rpc("rpc_performance_roleta");
      if (error) throw error;
      return ((data ?? []) as unknown as CorretorPerf[]).map((r) => ({ ...r, equipe: r.equipe || "Sem equipe" }));
    },
  });
}

export const MOTIVO_GRUPO = (codigo: string): "crm" | "visitas" | "descartes" | "outro" | "ok" =>
  codigo === "ok" ? "ok" : codigo === "crm" ? "crm" : codigo === "visitas_semana" ? "visitas" : codigo === "descartes" ? "descartes" : "outro";
