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
  equipe?: string | null;
}

export function useCorretoresOptions() {
  return useQuery({
    queryKey: ["corretores-options"],
    queryFn: async (): Promise<CorretorOption[]> => {
      // Fonte: team_members (leitura aberta a autenticados). user_roles tem RLS
      // que restringe não-admins a verem apenas o próprio registro, o que
      // deixava o gestor sem opções para repassar leads estagnados.
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, nome, equipe")
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? [])
        .filter((m) => {
          if (!m.user_id || !m.nome || seen.has(m.user_id)) return false;
          seen.add(m.user_id);
          return true;
        })
        .map((m) => ({ user_id: m.user_id as string, nome: m.nome as string, equipe: m.equipe }));
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
        devolver: "Lead devolvido ao corretor.",
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
