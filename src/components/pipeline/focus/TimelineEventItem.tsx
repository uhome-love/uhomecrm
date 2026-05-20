import { TimelineEvent } from "./useTimelineEvents";
import { formatBRT } from "@/lib/brtTime";
import {
  Phone, MessageCircle, FileText, Calendar, CheckCircle2,
  Clock, ArrowRightCircle, Sparkles, UserPlus, ListChecks
} from "lucide-react";

interface Props {
  event: TimelineEvent;
}

const KIND_STYLES: Record<TimelineEvent["kind"], { color: string; bg: string; ring: string; icon: any; label: string }> = {
  atividade:         { color: "#a5b4fc", bg: "rgba(79,70,229,0.15)",  ring: "rgba(79,70,229,0.35)",  icon: Sparkles,        label: "Atividade" },
  tarefa_pendente:   { color: "#fbbf24", bg: "rgba(245,158,11,0.15)", ring: "rgba(245,158,11,0.35)", icon: ListChecks,      label: "Tarefa pendente" },
  tarefa_concluida:  { color: "#4ade80", bg: "rgba(34,197,94,0.15)",  ring: "rgba(34,197,94,0.35)",  icon: CheckCircle2,    label: "Tarefa concluída" },
  stage_change:      { color: "#67e8f9", bg: "rgba(8,145,178,0.15)",  ring: "rgba(8,145,178,0.35)",  icon: ArrowRightCircle, label: "Etapa" },
  lead_created:      { color: "#94a3b8", bg: "rgba(148,163,184,0.15)", ring: "rgba(148,163,184,0.3)", icon: UserPlus,        label: "Lead criado" },
};

const TIPO_ICON: Record<string, any> = {
  ligacao: Phone,
  ligar: Phone,
  whatsapp: MessageCircle,
  mensagem: MessageCircle,
  nota: FileText,
  marcar_visita: Calendar,
  visita: Calendar,
  follow_up: Clock,
};

export default function TimelineEventItem({ event }: Props) {
  const style = KIND_STYLES[event.kind];
  const Icon = (event.tipo && TIPO_ICON[event.tipo]) || style.icon;
  const time = formatBRT(event.at, "dd/MM HH:mm");

  return (
    <div className="flex gap-3 group">
      {/* Dot + line */}
      <div className="flex flex-col items-center pt-1">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
          style={{ background: style.bg, border: `1px solid ${style.ring}`, color: style.color }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 w-px mt-1" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: style.color }}>
            {style.label}
          </span>
          <span className="text-[10px] text-gray-500 shrink-0" style={{ fontFamily: "var(--font-focus-mono, monospace)" }}>
            {time}
          </span>
        </div>
        <p className="text-sm text-gray-100 leading-snug break-words">{event.title}</p>
        {event.subtitle && (
          <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2 break-words">{event.subtitle}</p>
        )}
      </div>
    </div>
  );
}
