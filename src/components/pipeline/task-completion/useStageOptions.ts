/**
 * Sprint 1 R3-V2 — Stages disponíveis para opcional "mudar etapa" na Tela 2.
 *
 * Estratégia: pipeline_leads não tem pipeline_id explícito.
 * Resolução: ler o stage atual → pegar pipeline_tipo → listar todos
 * stages do mesmo pipeline_tipo (ativo=true) ordenados por `ordem`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageOption {
  id: string;
  nome: string;
  ordem: number | null;
  tipo: string | null;
}

export function useStageOptions(currentStageId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["task-completion-stages", currentStageId],
    enabled: enabled && !!currentStageId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<StageOption[]> => {
      if (!currentStageId) return [];
      const { data: current, error: e1 } = await supabase
        .from("pipeline_stages")
        .select("pipeline_tipo")
        .eq("id", currentStageId)
        .maybeSingle();
      if (e1 || !current?.pipeline_tipo) return [];
      const { data: stages, error: e2 } = await supabase
        .from("pipeline_stages")
        .select("id,nome,ordem,tipo")
        .eq("pipeline_tipo", current.pipeline_tipo)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (e2 || !stages) return [];
      return stages as StageOption[];
    },
  });
}
