import { memo, useState } from "react";
import type { PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MapPin, MessageCircle, ChevronRight, StickyNote, Eye, ArrowRightLeft } from "lucide-react";
import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PipelineCardProps {
  lead: PipelineLead;
  segmentos: PipelineSegmento[];
  onDragStart: () => void;
  onClick: () => void;
}

function getActivityInfo(stageChangedAt: string) {
  const now = new Date();
  const changed = new Date(stageChangedAt);
  const hours = differenceInHours(now, changed);
  const days = differenceInDays(now, changed);

  if (hours < 1) return { label: "Agora", variant: "new" as const };
  if (days >= 3) return { label: `${days}d`, variant: "danger" as const };
  if (hours >= 24) return { label: `${days}d`, variant: "warning" as const };
  if (hours >= 6) return { label: `${hours}h`, variant: "info" as const };
  return { label: `${hours}h`, variant: "ok" as const };
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

function getOrigemIcon(origem: string | null) {
  if (!origem) return null;
  const o = origem.toLowerCase();
  if (o.includes("meta") || o.includes("facebook") || o.includes("instagram")) return "📱";
  if (o.includes("tiktok")) return "🎵";
  if (o.includes("portal") || o.includes("site")) return "🌐";
  if (o.includes("indicacao") || o.includes("indicação")) return "🤝";
  if (o.includes("whatsapp")) return "💬";
  return "📌";
}

const PipelineCard = memo(function PipelineCard({ lead, segmentos, onDragStart, onClick }: PipelineCardProps) {
  const [hovered, setHovered] = useState(false);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const activity = getActivityInfo(lead.stage_changed_at);
  const origemIcon = getOrigemIcon(lead.origem);

  const handlePhoneClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(getWhatsAppUrl(phone), "_blank");
  };

  const handleCallClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(`tel:${phone}`, "_self");
  };

  const activityDot = {
    new: "bg-emerald-500",
    ok: "bg-blue-400",
    info: "bg-amber-400",
    warning: "bg-orange-500",
    danger: "bg-destructive",
  }[activity.variant];

  const initials = lead.nome
    .split(" ")
    .slice(0, 2)
    .map(n => n[0])
    .join("")
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          // Create a ghost element
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
        className="group relative rounded-xl border border-border/60 bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 select-none"
      >
        {/* Priority / Activity indicator line */}
        <div className={`absolute top-0 left-3 right-3 h-[2px] rounded-full ${activityDot} opacity-60`} />

        {/* Header: Avatar + Name + Segmento */}
        <div className="flex items-start gap-2.5 mb-2">
          <Avatar className="h-8 w-8 shrink-0 text-[10px] font-bold border border-border/50">
            <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground leading-tight line-clamp-1 block">
              {lead.nome}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {segmento && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-none"
                  style={{ backgroundColor: segmento.cor }}
                >
                  {segmento.nome.length > 12 ? segmento.nome.split(" ")[0] : segmento.nome}
                </span>
              )}
              {lead.origem && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  {origemIcon} {lead.origem.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Empreendimento */}
        {lead.empreendimento && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5 pl-0.5">
            <MapPin className="h-3 w-3 shrink-0 text-primary/50" />
            <span className="truncate font-medium">{lead.empreendimento}</span>
          </div>
        )}

        {/* Value */}
        {lead.valor_estimado && lead.valor_estimado > 0 && (
          <div className="text-xs font-bold text-foreground mb-2 pl-0.5">
            R$ {lead.valor_estimado.toLocaleString("pt-BR")}
          </div>
        )}

        {/* Footer: time + status */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <span className={`h-1.5 w-1.5 rounded-full ${activityDot}`} />
            <Clock className="h-2.5 w-2.5" />
            <span>{activity.label}</span>
          </div>
          {lead.telefone && (
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handleCallClick(e, lead.telefone!)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <Phone className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Ligar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handlePhoneClick(e, lead.telefone!)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <MessageCircle className="h-3 w-3 text-green-600 hover:text-green-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Quick Actions overlay on hover */}
        {hovered && (
          <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg p-0.5 z-10 animate-scale-in">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => handlePhoneClick(e, lead.telefone!)}
                    className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">WhatsApp</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;
