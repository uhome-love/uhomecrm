/**
 * Helper canônico para montar o texto de `motivo_descarte` em pipeline_leads.
 *
 * Esta é a ÚNICA fonte de verdade do prefix. Sweep 2026-05-22:
 * antes deste helper, descartes reengajáveis gravavam "Inativado: ..."
 * por engano (poluição de dados). Quem grava `motivo_descarte` em
 * qualquer fluxo (TaskCompletionDialog, PipelineLeadDetail.handleInativar,
 * FocusModeModal.handleDiscardLead, NextActionModal) DEVE usar este helper.
 *
 * Tipos:
 *  - 'reengajavel' → prefix "Descartado: " (lead pode receber oferta ativa/nutrição)
 *  - 'definitivo'  → prefix "Inativado: "  (lead arquivado, fica fora de tudo)
 */
export type LeadOutcomeTipo = "reengajavel" | "definitivo";

export const buildMotivoDescarte = (
  tipo: LeadOutcomeTipo,
  label: string,
): string => {
  const prefix = tipo === "reengajavel" ? "Descartado" : "Inativado";
  const cleanLabel = (label ?? "").trim() || "Sem motivo informado";
  return `${prefix}: ${cleanLabel}`;
};
