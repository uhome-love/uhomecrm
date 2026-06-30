import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PipelineLead, PipelineStage, PipelineSegmento } from "@/hooks/usePipeline";

/**
 * Carrega, sob demanda, os dados necessários para abrir o drawer
 * (PipelineLeadDetail) a partir da página de Leads Estagnados, sem precisar
 * montar o pipeline inteiro. Stages/segmentos são leves e ficam em cache.
 */
export function usePipelineMeta() {
  const stages = useQuery({
    queryKey: ["pipeline-meta-stages"],
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, nome, tipo, cor, ordem, pipeline_tipo")
        .eq("pipeline_tipo", "leads")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as PipelineStage[];
    },
    staleTime: 10 * 60_000,
  });

  const segmentos = useQuery({
    queryKey: ["pipeline-meta-segmentos"],
    queryFn: async (): Promise<PipelineSegmento[]> => {
      const { data, error } = await supabase
        .from("pipeline_segmentos")
        .select("id, nome, cor, ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as PipelineSegmento[];
    },
    staleTime: 10 * 60_000,
  });

  return {
    stages: stages.data ?? [],
    segmentos: segmentos.data ?? [],
    loading: stages.isLoading || segmentos.isLoading,
  };
}

export function useEstagnadoLeadDrawer() {
  const qc = useQueryClient();
  const [lead, setLead] = useState<PipelineLead | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);

  const openLead = useCallback(async (leadId: string) => {
    setLoadingLead(true);
    try {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Lead não encontrado.");
        return;
      }
      setLead(data as unknown as PipelineLead);
      setOpen(true);
    } catch (err) {
      console.error("[useEstagnadoLeadDrawer] openLead:", err);
      toast.error("Erro ao carregar o lead.");
    } finally {
      setLoadingLead(false);
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setLead(null);
    qc.invalidateQueries({ queryKey: ["pipeline-estagnacao"] });
  }, [qc]);

  const onUpdate = useCallback(async (leadId: string, updates: Partial<PipelineLead>) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from("pipeline_leads")
      .update(payload as any)
      .eq("id", leadId);
    if (error) {
      console.error("Error updating lead:", error);
      toast.error("Erro ao atualizar lead");
      return;
    }
    setLead((prev) => (prev && prev.id === leadId ? { ...prev, ...updates } : prev));
  }, []);

  const onMove = useCallback(async (leadId: string, newStageId: string, observacao?: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const now = new Date().toISOString();

    const current = lead && lead.id === leadId ? lead : null;
    const oldStageId = current?.stage_id ?? null;

    const updatePayload: Record<string, any> = {
      stage_id: newStageId,
      stage_changed_at: now,
      ultima_acao_at: now,
    };
    if (observacao) updatePayload.motivo_descarte = observacao;

    const { error } = await supabase
      .from("pipeline_leads")
      .update(updatePayload)
      .eq("id", leadId);
    if (error) {
      console.error("Error moving lead:", error);
      toast.error("Erro ao mover lead.");
      return;
    }

    await supabase.from("pipeline_historico").insert({
      pipeline_lead_id: leadId,
      stage_anterior_id: oldStageId,
      stage_novo_id: newStageId,
      movido_por: userId,
      observacao: observacao || null,
    });

    setLead((prev) =>
      prev && prev.id === leadId ? { ...prev, stage_id: newStageId, stage_changed_at: now } : prev,
    );
  }, [lead]);

  const onDelete = useCallback(async (leadId: string) => {
    const { error } = await supabase.from("pipeline_leads").delete().eq("id", leadId);
    if (error) {
      console.error("Error deleting lead:", error);
      toast.error("Erro ao apagar lead");
      return;
    }
    toast.success("Lead removido do pipeline");
    close();
  }, [close]);

  return { lead, open, loadingLead, openLead, close, onUpdate, onMove, onDelete };
}
