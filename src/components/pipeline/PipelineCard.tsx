import { memo, useState } from "react";
import type { PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MapPin, MessageCircle, Eye, Hourglass, Calendar } from "lucide-react";
import { differenceInHours, differenceInDays, differenceInMinutes } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PipelineCardProps {
  lead: PipelineLead;
  segmentos: PipelineSegmento[];
  corretorNome?: string;
  onDragStart: () => void;
  onClick: () => void;
}

function getActivityInfo(stageChangedAt: string) {
  const now = new Date();
  const changed = new Date(stageChangedAt);
  const mins = differenceInMinutes(now, changed);
  const hours = differenceInHours(now, changed);
  const days = differenceInDays(now, changed);

  if (mins < 5) return { label: "Agora", variant: "new" as const, timeText: "Agora" };
  if (mins < 60) return { label: `${mins}m`, variant: "new" as const, timeText: `${mins}m` };
  if (hours < 6) return { label: `${hours}h`, variant: "ok" as const, timeText: `${hours}h` };
  if (hours < 24) return { label: `${hours}h`, variant: "info" as const, timeText: `${hours}h` };
  if (days < 3) return { label: `${days}d`, variant: "warning" as const, timeText: `${days}d` };
  return { label: `${days}d`, variant: "danger" as const, timeText: `${days}d` };
}

function getTimeSinceCreated(createdAt: string) {
  const now = new Date();
  const created = new Date(createdAt);
  const mins = differenceInMinutes(now, created);
  const hours = differenceInHours(now, created);
  const days = differenceInDays(now, created);

  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

const activityStyles = {
  new: { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-500/30" },
  ok: { dot: "bg-blue-400", bg: "bg-blue-400/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-400/30" },
  info: { dot: "bg-amber-400", bg: "bg-amber-400/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-400/30" },
  warning: { dot: "bg-orange-500", bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  danger: { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
};

const PipelineCard = memo(function PipelineCard({ lead, segmentos, corretorNome, onDragStart, onClick }: PipelineCardProps) {
  const [hovered, setHovered] = useState(false);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const activity = getActivityInfo(lead.stage_changed_at);
  const createdTime = getTimeSinceCreated(lead.created_at);
  const style = activityStyles[activity.variant];

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(getWhatsAppUrl(phone), "_blank");
  };

  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(`tel:${phone}`, "_self");
  };

  const initials = lead.nome
    .split(" ")
    .slice(0, 2)
    .map(n => n[0])
    .join("")
    .toUpperCase();

  const showInactivityAlert = activity.variant === "warning" || activity.variant === "danger";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
          ghost.style.width = `${e.currentTarget.offsetWidth}px`;
          ghost.style.opacity = "0.85";
          ghost.style.transform = "rotate(2deg)";
          ghost.style.position = "absolute";
          ghost.style.top = "-1000px";
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 20, 20);
          setTimeout(() => document.body.removeChild(ghost), 0);
          onDragStart();
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative rounded-xl border border-border/60 bg-card p-0 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 select-none overflow-hidden"
      >
        {/* Activity indicator bar */}
        <div className={`h-[3px] w-full ${style.dot}`} />

        <div className="p-3 space-y-2">
          {/* Name */}
          <h4 className="text-[13px] font-bold text-foreground leading-tight line-clamp-1">
            {lead.nome}
          </h4>

          {/* Phone + WhatsApp */}
          {lead.telefone && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleCall(e, lead.telefone!)}
                className="text-[12px] font-medium text-primary hover:underline"
              >
                {formatPhone(lead.telefone)}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleWhatsApp(e, lead.telefone!)}
                    className="p-0.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Email */}
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{lead.email}</span>
            </div>
          )}

          {/* Empreendimento / Product */}
          {lead.empreendimento && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate font-medium">{lead.empreendimento}</span>
            </div>
          )}

          {/* Value */}
          {lead.valor_estimado && lead.valor_estimado > 0 && (
            <div className="text-[11px] text-muted-foreground italic">
              R$ {lead.valor_estimado.toLocaleString("pt-BR")}
            </div>
          )}
          {(!lead.valor_estimado || lead.valor_estimado <= 0) && (
            <div className="text-[11px] text-muted-foreground/50 italic">
              Valor não informado
            </div>
          )}

          {/* Time indicators */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {createdTime}
            </span>
            <span className="flex items-center gap-1">
              <Hourglass className="h-2.5 w-2.5" />
              {activity.timeText}
            </span>
          </div>

          {/* Origem / Campaign tag */}
          {lead.origem && (
            <div className="flex items-center gap-1.5">
              {segmento && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-none"
                  style={{ backgroundColor: segmento.cor }}
                >
                  {segmento.nome.length > 10 ? segmento.nome.split(" ")[0] : segmento.nome}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/60 truncate">
                {lead.origem.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* Footer: corretor info + inactivity alert */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
            {/* Corretor info */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar className="h-5 w-5 text-[8px] border border-border/40 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-[8px]">
                  {corretorNome ? corretorNome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px] font-medium">
                {corretorNome || "Sem corretor"}
              </span>
            </div>

            {/* Activity badge */}
            {showInactivityAlert ? (
              <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text} ${style.border} border`}>
                <Calendar className="h-2.5 w-2.5" />
                Sem atividade!
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {activity.label}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions overlay on hover */}
        {hovered && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-0.5 z-10 animate-scale-in">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                  className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Abrir lead</TooltipContent>
            </Tooltip>
            {lead.telefone && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => handleCall(e, lead.telefone!)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Ligar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => handleWhatsApp(e, lead.telefone!)}
                      className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">WhatsApp</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;
