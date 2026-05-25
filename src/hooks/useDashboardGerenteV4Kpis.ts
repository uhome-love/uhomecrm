import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpisTopV4 {
  leads_recebidos: number;
  leads_recebidos_anterior: number;
  leads_meta: number;
  leads_delta_pct: number | null;

  visitas_realizadas: number;
  visitas_agendadas: number;
  visitas_total: number;
  visitas_meta: number;
  visitas_delta_pct: number | null;

  negocios_ativos: number;
  negocios_meta: number;

  vendas_vgv: number;
  vendas_count: number;
  vendas_meta_vgv: number;
  vendas_delta_pct: number | null;

  periodo: "hoje" | "semana" | "mes";
  p_start: string;
  p_end: string;
}

export interface AlertaCorretorV4 {
  corretor_id: string;
  auth_id: string;
  nome: string;
  avatar_url: string | null;
  tarefas_atrasadas: number;
  leads_sem_acao_30d: number;
  score_soma: number;
  severity: "critico" | "atencao";
}

export interface DashboardV4KpisPayload {
  kpis_top: KpisTopV4;
  alertas_corretores: AlertaCorretorV4[];
}

/**
 * KPIs do Dashboard Gerente v4 — sempre no escopo MÊS (contexto estratégico).
 * Os controles operacionais de período ficam nos painéis individuais.
 */
export function useDashboardGerenteV4Kpis(gestorId: string | undefined) {
  return useQuery({
    queryKey: ["dash-v4-kpis", gestorId],
    enabled: !!gestorId,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<DashboardV4KpisPayload> => {
      const { data, error } = await supabase.rpc("get_dashboard_gerente_v4_kpis", {
        p_gestor_id: gestorId!,
        p_periodo: "mes",
      });
      if (error) throw error;
      return data as unknown as DashboardV4KpisPayload;
    },
  });
}
