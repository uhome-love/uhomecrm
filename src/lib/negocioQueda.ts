import { supabase } from "@/integrations/supabase/client";
import { buildMotivoDescarte } from "@/lib/leadOutcome";
import { toast } from "sonner";

export type QuedaDestino = "pipeline" | "descarte" | "inativar";

interface ApplyQuedaParams {
  negocioId: string;
  pipelineLeadId?: string | null;
  motivo: string;
  destino: QuedaDestino;
  /** Etapa de retorno quando destino = 'pipeline'. */
  stageId?: string | null;
}

/**
 * Aplica a "queda" de um negócio (Fase 4 do Pipeline unificado):
 *  - grava `motivo_queda` no negócio;
 *  - trata o lead vinculado conforme o destino escolhido:
 *      • pipeline  → volta o lead para a etapa escolhida e limpa `negocio_id`;
 *      • descarte  → move o lead para a etapa Descarte (reengajável por nutrição/oferta ativa);
 *      • inativar  → arquiva o lead definitivamente (fica fora de tudo).
 *
 * A mudança de `fase`/`status` do negócio para "perdido" é responsabilidade do
 * chamador (moveFase). Esta função cuida só de motivo + lado do lead.
 */
export async function applyNegocioQueda({
  negocioId,
  pipelineLeadId,
  motivo,
  destino,
  stageId,
}: ApplyQuedaParams): Promise<void> {
  const nowIso = new Date().toISOString();
  const motivoLimpo = (motivo || "").trim() || "Sem motivo informado";

  // 1) Grava motivo no negócio
  await supabase
    .from("negocios")
    .update({ motivo_queda: motivoLimpo, updated_at: nowIso } as any)
    .eq("id", negocioId);

  if (!pipelineLeadId) return;

  // 2) Lado do lead
  if (destino === "pipeline") {
    if (!stageId) return;
    await supabase
      .from("pipeline_leads")
      .update({
        stage_id: stageId,
        negocio_id: null,
        stage_changed_at: nowIso,
        updated_at: nowIso,
      } as any)
      .eq("id", pipelineLeadId);
    toast.success("🔄 Lead retornado ao Pipeline");
    return;
  }

  if (destino === "inativar") {
    await supabase
      .from("pipeline_leads")
      .update({
        motivo_descarte: buildMotivoDescarte("definitivo", motivoLimpo),
        tipo_descarte: "definitivo",
        arquivado: true,
        negocio_id: null,
        ultima_acao_at: nowIso,
        updated_at: nowIso,
      } as any)
      .eq("id", pipelineLeadId);
    toast.success("Lead inativado definitivamente");
    return;
  }

  // destino === "descarte" (reengajável)
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, nome, tipo")
    .eq("pipeline_tipo", "leads")
    .eq("ativo", true);
  const descarte =
    (stages || []).find((s: any) => s.tipo === "descarte") ||
    (stages || []).find((s: any) => s.nome?.toLowerCase().includes("descart"));
  if (!descarte) {
    toast.error("Etapa de Descarte não encontrada. Contate o suporte.");
    return;
  }
  await supabase
    .from("pipeline_leads")
    .update({
      motivo_descarte: buildMotivoDescarte("reengajavel", motivoLimpo),
      tipo_descarte: "reengajavel",
      stage_id: descarte.id,
      negocio_id: null,
      stage_changed_at: nowIso,
      ultima_acao_at: nowIso,
      updated_at: nowIso,
    } as any)
    .eq("id", pipelineLeadId);
  toast.info("Lead movido para Descarte (reengajável)");
}
