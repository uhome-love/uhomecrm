import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CategoriaEstagnacao = "candidato" | "em_parceria" | "em_aviso" | "estagnado";

export interface LeadEstagnacao {
  lead_id: string;
  nome: string;
  empreendimento: string | null;
  etapa: string;
  stage_id: string;
  corretor_id: string | null;
  corretor_nome: string | null;
  dias_limite: number;
  ultima_acao_humana: string | null;
  dias_sem_acao: number;
  categoria: CategoriaEstagnacao;
  estagnado_prazo_em: string | null;
}

export function usePipelineEstagnacao() {
  return useQuery({
    queryKey: ["pipeline-estagnacao"],
    queryFn: async (): Promise<LeadEstagnacao[]> => {
      const { data, error } = await supabase.rpc("get_pipeline_estagnacao");
      if (error) throw error;
      return (data ?? []) as LeadEstagnacao[];
    },
    staleTime: 60_000,
  });
}
