import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PerfSeveridade =
  | "sla_vermelho"
  | "no_show_alto"
  | "wip_negociacao_alto"
  | "baixo_esforco_oa"
  | "vgv_zerado"
  | "presenca_baixa";

export interface PerfDiagnosticoItem {
  profile_id: string;
  nome: string;
  severidade: PerfSeveridade;
  contexto: {
    vgv_vendido: number;
    sla_mediana_min: number | null;
    qtd_no_show: number;
    qtd_tentativas_oa: number;
    presenca_pct: number;
    qtd_negociacao: number;
  };
}

export interface PerfRankingItem {
  profile_id: string;
  auth_user_id: string;
  nome: string;
  vgv_vendido: number;
  qtd_ganho: number;
  qtd_contrato: number;
  qtd_negociacao: number;
  qtd_visitas_realizadas: number;
  qtd_no_show: number;
  qtd_visitas_total: number;
  qtd_tentativas_oa: number;
  qtd_oa_aproveitados: number;
  dias_presenca: number;
  presenca_pct: number;
  sla_mediana_min: number | null;
  qtd_sem_contato: number;
}

export interface PerfDashboardPayload {
  periodo: { inicio: string; fim: string; dias_uteis: number };
  thresholds: Record<string, unknown>;
  ranking: PerfRankingItem[];
  diagnostico: PerfDiagnosticoItem[];
  escopo: "admin" | "gestor" | "self";
}

export function usePerformanceDashboard(inicio?: string, fim?: string) {
  return useQuery({
    queryKey: ["perf-dashboard", inicio, fim],
    queryFn: async (): Promise<PerfDashboardPayload> => {
      const { data, error } = await supabase.rpc("rpc_perf_dashboard", {
        p_inicio: inicio,
        p_fim: fim,
      } as any);
      if (error) throw error;
      return data as unknown as PerfDashboardPayload;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
