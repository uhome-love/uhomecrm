import type { PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MapPin, AlertTriangle, MessageCircle } from "lucide-react";
import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PipelineCardProps {
  lead: PipelineLead;
  segmentos: PipelineSegmento[];
  onDragStart: () => void;
  onClick: () => void;
}

function getActivityBadge(stageChangedAt: string) {
  const now = new Date();
  const changed = new Date(stageChangedAt);
  const hours = differenceInHours(now, changed);
  const days = differenceInDays(now, changed);

  if (hours < 1) return null; // recently moved, no badge
  if (days >= 3) {
    return { label: `${days}d sem atividade`, variant: "danger" as const };
  }
  if (hours >= 24) {
    return { label: `${days}d sem atividade`, variant: "warning" as const };
  }
  if (hours >= 6) {
    return { label: `${hours}h sem atividade`, variant: "info" as const };
  }
  return null;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export default function PipelineCard({ lead, segmentos, onDragStart, onClick }: PipelineCardProps) {
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const timeInStage = formatDistanceToNow(new Date(lead.stage_changed_at), { locale: ptBR, addSuffix: false });
  const activityBadge = getActivityBadge(lead.stage_changed_at);

  const handlePhoneClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(getWhatsAppUrl(phone), "_blank");
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-md transition-all duration-150 select-none"
    >
      {/* Name + Segmento */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
          {lead.nome}
        </span>
        {segmento && (
          <span
            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: segmento.cor }}
          >
            {segmento.nome.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Phone with WhatsApp link */}
      {lead.telefone && (
        <button
          onClick={(e) => handlePhoneClick(e, lead.telefone!)}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 hover:underline mb-0.5 font-medium"
        >
          <Phone className="h-3 w-3 shrink-0" />
          {formatPhone(lead.telefone)}
          <MessageCircle className="h-3 w-3 shrink-0 text-green-600" />
        </button>
      )}

      {/* Email */}
      {lead.email && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 truncate">
          <Mail className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.email}</span>
        </div>
      )}

      {/* Empreendimento */}
      {lead.empreendimento && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.empreendimento}</span>
        </div>
      )}

      {/* Value */}
      {lead.valor_estimado && lead.valor_estimado > 0 ? (
        <div className="text-[11px] font-semibold text-foreground mb-1.5">
          R$ {lead.valor_estimado.toLocaleString("pt-BR")}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground/50 italic mb-1.5">
          Valor não informado
        </div>
      )}

      {/* Footer: time in stage + activity badge */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {timeInStage}
          </span>
          {lead.origem && (
            <span className="truncate capitalize">
              {lead.origem.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {activityBadge && (
          <span
            className={`flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
              activityBadge.variant === "danger"
                ? "bg-destructive/10 text-destructive"
                : activityBadge.variant === "warning"
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {activityBadge.label}
          </span>
        )}
      </div>
    </div>
  );
}
