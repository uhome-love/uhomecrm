import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export type AcaoEstagnacao = "devolver" | "repassar" | "roleta" | "descartar";

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

export interface CorretorOption {
  user_id: string;
  nome: string;
}

export function useCorretoresOptions() {
  return useQuery({
    queryKey: ["corretores-options"],
    queryFn: async (): Promise<CorretorOption[]> => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "corretor");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r) => r.user_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profs, error: profError } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", ids)
        .order("nome");
      if (profError) throw profError;
      return (profs ?? [])
        .filter((p) => p.user_id && p.nome)
        .map((p) => ({ user_id: p.user_id as string, nome: p.nome as string }));
    },
    staleTime: 5 * 60_000,
  });
}

interface DecidirArgs {
  leadId: string;
  acao: AcaoEstagnacao;
  corretorDestino?: string;
  motivo?: string;
}

export function useDecidirEstagnado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, acao, corretorDestino, motivo }: DecidirArgs) => {
      const { data, error } = await supabase.rpc("decidir_lead_estagnado", {
        p_lead_id: leadId,
        p_acao: acao,
        p_corretor_destino: corretorDestino ?? null,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res?.success) throw new Error(res?.error || "Falha ao decidir lead");
      return res;
    },
    onSuccess: (_res, vars) => {
      const labels: Record<AcaoEstagnacao, string> = {
        repassar: "Lead repassado para outro corretor.",
        roleta: "Lead enviado para a Fila do CEO.",
        descartar: "Lead descartado (reengajável).",
      };
      toast.success(labels[vars.acao]);
      qc.invalidateQueries({ queryKey: ["pipeline-estagnacao"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao processar decisão.");
    },
  });
}
