import { useMemo } from "react";
import { format, isToday as isTodayFn, isTomorrow as isTomorrowFn, isYesterday as isYesterdayFn, startOfDay } from "date-fns";
import type { PipelineLead } from "@/hooks/usePipeline";

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

export interface CardStatusResult {
  indicator: string | null;
  indicatorCls: string;
  text: string;
  textCls: string;
  borderCls: string;
}

export interface ProximaTarefa {
  tipo: string;
  vence_em: string | null;
  hora_vencimento: string | null;
}

function getTaskDate(task: ProximaTarefa | null | undefined, lead: PipelineLead): Date | null {
  if (task?.vence_em) {
    const taskDate = toValidDateFromYMD(task.vence_em);
    if (taskDate) return taskDate;
  }
  return toValidDateFromYMD((lead as any).data_proxima_acao);
}

function getTaskLabel(task: ProximaTarefa | null | undefined, lead: PipelineLead) {
  if (task?.tipo) return TIPO_LABELS[task.tipo] || task.tipo;
  return lead.proxima_acao || "Follow-up";
}

function getTaskHour(task: ProximaTarefa | null | undefined) {
  return task?.hora_vencimento?.slice(0, 5) || "";
}

export function getLeadStatusFilter(lead: PipelineLead, proximaTarefa: ProximaTarefa | null, stageTipo?: string): LeadClientStatus {
  // Leads descartados não são considerados atrasados/desatualizados
  if (stageTipo === "descarte") return "em_dia";
  // Leads com negócio criado (negocio_id) são sempre considerados "em dia"
  if ((lead as any).negocio_id) return "em_dia";

  const todayStart = startOfDay(new Date());
  const taskDate = getTaskDate(proximaTarefa, lead);

  if (!taskDate) {
    if (proximaTarefa?.tipo) return "em_dia";
    return "desatualizado";
  }

  return taskDate < todayStart ? "tarefa_atrasada" : "em_dia";
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

export function getCardStatus(lead: PipelineLead, proximaTarefa: ProximaTarefa | null, stageTipo?: string): CardStatusResult {
  if (stageTipo === "descarte") {
    return { indicator: "⚫", indicatorCls: "text-muted-foreground", text: "Descartado", textCls: "text-muted-foreground", borderCls: "border-l-muted" };
  }
  const status = getLeadStatusFilter(lead, proximaTarefa, stageTipo);
  const taskDate = getTaskDate(proximaTarefa, lead);
  const hora = getTaskHour(proximaTarefa);
  const label = getTaskLabel(proximaTarefa, lead);

  if (status === "tarefa_atrasada" && taskDate) {
    const dateLabel = isYesterdayFn(taskDate) ? "ontem" : format(taskDate, "dd/MM");
    return { indicator: "🔴", indicatorCls: "text-destructive", text: `🔴 Atrasado: ${label} ${dateLabel} ${hora}`.trim(), textCls: "text-destructive font-semibold", borderCls: "border-l-destructive" };
  }

  if (status === "em_dia") {
    if (!taskDate) {
      return { indicator: "✅", indicatorCls: "text-green-500", text: "✅ Em dia", textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
    }

    if (isTodayFn(taskDate)) {
      return { indicator: "✅", indicatorCls: "text-green-500", text: `✅ Hoje ${hora}: ${label}`.trim(), textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
    }

    const dateLabel = isTomorrowFn(taskDate) ? "amanhã" : format(taskDate, "dd/MM");
    return { indicator: "✅", indicatorCls: "text-green-500", text: `✅ Próximo: ${label} ${dateLabel} ${hora}`.trim(), textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
  }

  return { indicator: "🟡", indicatorCls: "text-amber-500", text: "🟡 Desatualizado · sem tarefa futura", textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
}

interface CardStatusLineProps {
  status: CardStatusResult;
  stageChangedAt: string | null | undefined;
}

export default function CardStatusLine({ status }: CardStatusLineProps) {
  const statusColor = useMemo(() => {
    if (status.indicator === "🔴") return "#DC2626";
    if (status.indicator === "🟡" || status.indicator === "⚠️") return "#D97706";
    return "#059669";
  }, [status.indicator]);

  return (
    <div className="flex items-center justify-between gap-1" style={{ paddingTop: 2 }}>
      <p style={{
        fontSize: 11, fontWeight: 600, color: statusColor,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {status.text || "✅ Em dia"}
      </p>
    </div>
  );
}

export { TIPO_LABELS, toValidDateFromYMD };
