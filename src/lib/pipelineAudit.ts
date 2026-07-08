// ─────────────────────────────────────────────────────────────────
// pipelineAudit — registra no Histórico do lead (pipeline_atividades)
// as alterações de substatus e de etapa, com data, usuário e motivo.
// Fonte única de labels: leadHelpers.ts.
// ─────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import {
  QUALIFICACAO_SUBSTATUS,
  AQUECIMENTO_SUBSTATUS,
  VISITA_SUBSTATUS,
  NEGOCIACAO_SUBSTATUS,
  CONTRATO_SUBSTATUS,
  type SubstatusOption,
} from "@/lib/leadHelpers";

/** Nome legível de cada campo de substatus (chave em flag_status). */
export const SUBSTATUS_FIELD_LABEL: Record<string, string> = {
  status_atendimento: "Qualificação",
  prazo: "Aquecimento",
  status_visita: "Visita",
  status_negociacao: "Em Negociação",
  status_contrato: "Contrato",
  impressao: "Impressão",
  intencao: "Intenção",
  status_busca: "Busca",
  interesse: "Interesse",
};

const FIELD_OPTIONS: Record<string, SubstatusOption[]> = {
  status_atendimento: QUALIFICACAO_SUBSTATUS,
  prazo: AQUECIMENTO_SUBSTATUS,
  status_visita: VISITA_SUBSTATUS,
  status_negociacao: NEGOCIACAO_SUBSTATUS,
  status_contrato: CONTRATO_SUBSTATUS,
};

/** Converte o value canônico de um campo no seu label amigável. */
export function substatusValueLabel(field: string, value: string | null | undefined): string {
  if (!value) return "—";
  const opts = FIELD_OPTIONS[field];
  const found = opts?.find((o) => o.value === value);
  return found?.label ?? value;
}

interface SubstatusChangeCtx {
  pipelineLeadId: string;
  userId: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  motivo?: string | null;
}

/**
 * Registra uma alteração de substatus no Histórico do lead.
 * Não bloqueia o fluxo em caso de erro (best-effort).
 */
export async function logSubstatusChange(ctx: SubstatusChangeCtx): Promise<void> {
  const { pipelineLeadId, userId, field, oldValue, newValue, motivo } = ctx;
  if (!pipelineLeadId || !userId) return;
  if ((oldValue || "") === (newValue || "")) return;

  const fieldLabel = SUBSTATUS_FIELD_LABEL[field] || field;
  const to = substatusValueLabel(field, newValue);
  const from = substatusValueLabel(field, oldValue);
  const descricao = [
    `${fieldLabel}: ${from} → ${to}`,
    motivo && `Motivo: ${motivo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: pipelineLeadId,
      tipo: "sistema",
      titulo: `Substatus atualizado — ${fieldLabel}`,
      descricao,
      created_by: userId,
    } as any);
  } catch (e) {
    console.error("[logSubstatusChange] erro ao registrar histórico:", e);
  }
}

interface StageChangeCtx {
  pipelineLeadId: string;
  userId: string;
  fromStageName?: string | null;
  toStageName?: string | null;
  motivo?: string | null;
}

/**
 * Registra uma mudança de etapa no Histórico do lead (pipeline_atividades).
 * O registro estruturado de movimentação continua em pipeline_historico;
 * este entra na timeline legível do lead.
 */
export async function logStageChange(ctx: StageChangeCtx): Promise<void> {
  const { pipelineLeadId, userId, fromStageName, toStageName, motivo } = ctx;
  if (!pipelineLeadId || !userId) return;

  const descricao = [
    fromStageName && toStageName
      ? `${fromStageName} → ${toStageName}`
      : toStageName
      ? `Movido para ${toStageName}`
      : null,
    motivo && `Motivo: ${motivo}`,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    await supabase.from("pipeline_atividades").insert({
      pipeline_lead_id: pipelineLeadId,
      tipo: "sistema",
      titulo: "Etapa alterada",
      descricao: descricao || "Etapa alterada",
      created_by: userId,
    } as any);
  } catch (e) {
    console.error("[logStageChange] erro ao registrar histórico:", e);
  }
}
