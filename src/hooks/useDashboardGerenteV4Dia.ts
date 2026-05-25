import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VisitasRangeV4 = "hoje" | "semana";

export interface VisitaV4 {
  visita_id: string;
  data_visita: string;
  horario_str: string;
  hora_visita: string | null;
  cliente_nome: string | null;
  imovel_resumo: string | null;
  corretor_id: string;
  corretor_nome: string | null;
  corretor_avatar: string | null;
  status: string;
}

export interface MiniPipelineCard {
  negocio_id: string;
  cliente_nome: string | null;
  vgv: number | null;
}

export interface MiniPipelineFase {
  fase: string;
  fase_label: string;
  ordem: number;
  count_total: number;
  top_cards: MiniPipelineCard[];
}

export interface RoletaCredenciado {
  corretor_id: string;
  nome: string | null;
  avatar_url: string | null;
  janela: "manha" | "tarde" | "noturna" | "dia_todo" | string;
  turno_ativo_agora: boolean;
  leads_recebidos_dia: number;
  leads_aceitos_dia: number;
}

export interface RoletaDia {
  turno_ativo_atual: "manha" | "tarde" | "noturna" | string;
  credenciados: RoletaCredenciado[];
}

export interface DashboardV4DiaPayload {
  visitas: VisitaV4[];
  mini_pipeline: MiniPipelineFase[];
  roleta_dia: RoletaDia;
}

export function useDashboardGerenteV4Dia(
  gestorId: string | undefined,
  visitasRange: VisitasRangeV4 = "hoje",
) {
  return useQuery({
    queryKey: ["dash-v4-dia", gestorId, visitasRange],
    enabled: !!gestorId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async (): Promise<DashboardV4DiaPayload> => {
      const { data, error } = await supabase.rpc("get_dashboard_gerente_v4_dia", {
        p_gestor_id: gestorId!,
        p_visitas_range: visitasRange,
      });
      if (error) throw error;
      return data as unknown as DashboardV4DiaPayload;
    },
  });
}
