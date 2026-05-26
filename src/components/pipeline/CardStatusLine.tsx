// ─────────────────────────────────────────────────────────────────
// CardStatusLine — Módulo de utilidades de status de lead/tarefa.
//
// Histórico: este arquivo originalmente exportava um componente JSX
// (CardStatusLine) consumido pelo legacy PipelineCard.tsx. O componente
// e a função getCardStatus foram removidos em Mai/2026 junto com o
// PipelineCard. O arquivo permanece como utils puros porque os símbolos
// abaixo ainda são consumidos por:
//   - src/pages/MinhasTarefas.tsx
//   - src/pages/PipelineKanban.tsx
//   - src/components/pipeline/PipelineHeader.tsx
//   - src/components/pipeline/PipelineAdvancedFilters.tsx
//   - src/components/pipeline/PipelineManagerActions.tsx
//   - src/components/pipeline/CardQuickTaskPopover.tsx (TIPO_LABELS)
//
// Ticket Quality Sprint pendente: renomear para src/lib/leadStatusUtils.ts
// e atualizar os 6 imports acima.
// ─────────────────────────────────────────────────────────────────

import type { PipelineLead } from "@/hooks/usePipeline";
import { classifyTask } from "@/lib/taskBuckets";

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp",
  enviar_proposta: "Proposta", enviar_material: "Material",
  marcar_visita: "Visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar", outro: "Tarefa",
};

function toValidDateFromYMD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type LeadClientStatus = "em_dia" | "desatualizado" | "tarefa_atrasada";

export interface ProximaTarefa {
  tipo: string;
  vence_em: string | null;
  hora_vencimento: string | null;
}

export function getLeadStatusFilter(lead: PipelineLead, proximaTarefa: ProximaTarefa | null, stageTipo?: string): LeadClientStatus {
  // Leads descartados não são considerados atrasados/desatualizados
  if (stageTipo === "descarte") return "em_dia";
  // Leads com negócio criado (negocio_id) são sempre considerados "em dia"
  if ((lead as any).negocio_id) return "em_dia";

  // Sem tarefa pendente real (pipeline_tarefas): não usar fallback para
  // lead.data_proxima_acao — esse campo legado costuma ficar desatualizado
  // (não é zerado ao concluir tarefa) e gerava falsos "🔴 Atrasado".
  if (!proximaTarefa?.vence_em) {
    if (proximaTarefa?.tipo) return "em_dia";
    return "desatualizado";
  }

  // Regra canônica única de classificação — ver src/lib/taskBuckets.ts.
  const { isOverdue } = classifyTask(proximaTarefa);
  return isOverdue ? "tarefa_atrasada" : "em_dia";
}

export function isTaskHigherPriority(candidate: ProximaTarefa, current: ProximaTarefa) {
  const candidateDate = candidate.vence_em ? toValidDateFromYMD(candidate.vence_em) : null;
  const currentDate = current.vence_em ? toValidDateFromYMD(current.vence_em) : null;

  if (candidateDate && !currentDate) return true;
  if (!candidateDate && currentDate) return false;
  if (candidateDate && currentDate) {
    if (candidateDate.getTime() !== currentDate.getTime()) {
      return candidateDate.getTime() < currentDate.getTime();
    }

    const candidateHour = candidate.hora_vencimento || "23:59";
    const currentHour = current.hora_vencimento || "23:59";
    return candidateHour < currentHour;
  }

  return false;
}

export { TIPO_LABELS, toValidDateFromYMD };
