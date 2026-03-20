import { useMemo } from "react";
import { differenceInHours, differenceInDays, isToday as isTodayFn, isTomorrow as isTomorrowFn, isYesterday as isYesterdayFn, startOfDay, format } from "date-fns";
import type { PipelineLead } from "@/hooks/usePipeline";

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp",
  enviar_proposta: "Proposta", enviar_material: "Material",
  marcar_visita: "Visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar", outro: "Tarefa",
};

function toValidDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toValidDateFromYMD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface CardStatusResult {
  indicator: string | null;
  indicatorCls: string;
  text: string;
  textCls: string;
  borderCls: string;
}

interface ProximaTarefa {
  tipo: string;
  vence_em: string | null;
  hora_vencimento: string | null;
}

export function getCardStatus(lead: PipelineLead, proximaTarefa: ProximaTarefa | null): CardStatusResult {
  const now = new Date();
  const todayStart = startOfDay(now);

  // Lead has a scheduled task → always "em dia" unless overdue
  if (proximaTarefa?.vence_em) {
    const d = toValidDateFromYMD(proximaTarefa.vence_em);
    const hora = proximaTarefa.hora_vencimento?.slice(0, 5) || "";
    const label = TIPO_LABELS[proximaTarefa.tipo] || proximaTarefa.tipo;

    if (!d) {
      // Has task but invalid date — still counts as "em dia" (has action pending)
      return { indicator: "✅", indicatorCls: "text-green-500", text: `✅ Próximo: ${label} ${hora}`.trim(), textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
    }
    if (d < todayStart) {
      const dateLabel = isYesterdayFn(d) ? "ontem" : format(d, "dd/MM");
      return { indicator: "🔴", indicatorCls: "text-destructive", text: `🔴 Atrasado: ${label} ${dateLabel} ${hora}`, textCls: "text-destructive font-semibold", borderCls: "border-l-destructive" };
    }
    if (isTodayFn(d)) {
      return { indicator: "✅", indicatorCls: "text-green-500", text: `🟡 Hoje ${hora}: ${label}`, textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
    }
    const dateLabel = isTomorrowFn(d) ? "amanhã" : format(d, "dd/MM");
    return { indicator: "✅", indicatorCls: "text-green-500", text: `✅ Próximo: ${label} ${dateLabel} ${hora}`, textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
  }

  const lastContactDate = toValidDate((lead as any).ultima_acao_at);
  if (!lastContactDate) {
    const stageDate = toValidDate(lead.stage_changed_at);
    const hoursInStage = stageDate ? differenceInHours(now, stageDate) : 999;
    if (Number.isFinite(hoursInStage) && hoursInStage < 2) {
      return { indicator: null, indicatorCls: "", text: "", textCls: "", borderCls: "border-l-blue-400" };
    }
    if (Number.isFinite(hoursInStage) && hoursInStage < 24) {
      return { indicator: "🟡", indicatorCls: "text-amber-500", text: "🟡 Aguardando primeiro contato", textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
    }
    return { indicator: "🟡", indicatorCls: "text-amber-500", text: "🟡 Sem contato · Aguardando ação", textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
  }

  const hoursSinceContact = differenceInHours(now, lastContactDate);
  if (!Number.isFinite(hoursSinceContact)) {
    return { indicator: "🟡", indicatorCls: "text-amber-500", text: "🟡 Sem contato · Aguardando ação", textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
  }
  if (hoursSinceContact <= 24) {
    return { indicator: "✅", indicatorCls: "text-green-500", text: "✅ Em dia · contato recente", textCls: "text-muted-foreground", borderCls: "border-l-green-400" };
  }
  if (hoursSinceContact <= 48) {
    return { indicator: "🟡", indicatorCls: "text-amber-500", text: "🟡 Desatualizado · sem contato há +24h", textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
  }
  const dias = differenceInDays(now, lastContactDate);
  return { indicator: "🟡", indicatorCls: "text-amber-500", text: `🟡 Desatualizado · sem contato há ${dias}d`, textCls: "text-amber-600 dark:text-amber-400 font-semibold", borderCls: "border-l-amber-400" };
}

interface CardStatusLineProps {
  status: CardStatusResult;
  stageChangedAt: string | null | undefined;
}

export default function CardStatusLine({ status }: CardStatusLineProps) {
  // Determine colors based on status
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

export { TIPO_LABELS, toValidDate, toValidDateFromYMD };
