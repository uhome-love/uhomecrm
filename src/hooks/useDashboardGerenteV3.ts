import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodoV3 = "hoje" | "semana" | "mes";

export interface KpisTopV3 {
  vendas: number;
  vendas_qtd: number;
  meta_vendas: number;
  leads: number;
  meta_leads: number;
  visitas: number;
  meta_visitas: number;
  negocios: number;
  meta_negocios: number;
  delta_vendas: number | null;
  delta_leads: number | null;
  delta_visitas: number | null;
  delta_negocios: number | null;
  periodo: PeriodoV3;
  p_start: string;
  p_end: string;
}

export type CorretorStatusV3 = "top" | "em_alta" | "ok" | "atencao" | "critico";

export interface CorretorRowV3 {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  vendas_vgv: number;
  leads_recebidos: number;
  leads_total: number;
  leads_ativos: number;
  leads_sem_acao_30d: number;
  pipe_em_dia: number;
  pipe_total: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  negocios_ativos: number;
  negocios: number;
  tarefas_atrasadas: number;
  dias_em_alta: number;
  status: CorretorStatusV3;
  meta_line: string | null;
}

export interface DashboardGerenteV3Payload {
  kpis_top: KpisTopV3;
  corretores: CorretorRowV3[];
  meta_id: string | null;
  mes_key: string;
}

export function useDashboardGerenteV3(gestorId: string | undefined, periodo: PeriodoV3) {
  return useQuery({
    queryKey: ["dashboard-gerente-v3", gestorId, periodo],
    enabled: !!gestorId,
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardGerenteV3Payload> => {
      const { data, error } = await supabase.rpc("get_dashboard_gerente", {
        p_gestor_id: gestorId!,
        p_periodo: periodo,
      });
      if (error) throw error;
      return data as unknown as DashboardGerenteV3Payload;
    },
  });
}
