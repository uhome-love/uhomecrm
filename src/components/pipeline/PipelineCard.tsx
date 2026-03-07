import { memo, useState } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MapPin, MessageCircle, Eye, Hourglass, Calendar, Flame, Thermometer, Snowflake, Zap, Shield, Users, Handshake, AlertCircle, Timer } from "lucide-react";
import { differenceInHours, differenceInDays, differenceInMinutes } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PipelineQuickTransfer from "./PipelineQuickTransfer";
import { calculateLeadScore, getSlaStatus } from "@/lib/leadScoring";

function formatSlaTime(mins: number): string {
  const abs = Math.abs(mins);
  if (abs < 60) return `${abs}m`;
  if (abs < 1440) return `${Math.floor(abs / 60)}h`;
  return `${Math.floor(abs / 1440)}d`;
}

interface PipelineCardProps {
  lead: PipelineLead;
  stage?: PipelineStage;
  segmentos: PipelineSegmento[];
  corretorNome?: string;
  gerenteNome?: string;
  parceiroNome?: string;
  onDragStart: () => void;
  onClick: () => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
}

type ActivityVariant = "active" | "ok" | "warning" | "danger";

function getActivityInfo(stageChangedAt: string): { label: string; variant: ActivityVariant; timeText: string } {
  const now = new Date();
  const changed = new Date(stageChangedAt);
  const mins = differenceInMinutes(now, changed);
  const hours = differenceInHours(now, changed);
  const days = differenceInDays(now, changed);

  if (mins < 30) return { label: mins < 5 ? "Agora" : `${mins}m`, variant: "active", timeText: mins < 5 ? "Agora" : `${mins}m` };
  if (mins < 120) return { label: `${mins}m`, variant: "warning", timeText: `${mins}m` };
  if (hours < 24) return { label: `${hours}h`, variant: "danger", timeText: `${hours}h` };
  return { label: `${days}d`, variant: "danger", timeText: `${days}d` };
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

// Card border + bar color based on activity
const activityStyles: Record<ActivityVariant, { dot: string; border: string; bg: string; text: string }> = {
  active: { dot: "bg-emerald-500", border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  ok: { dot: "bg-blue-400", border: "border-blue-400/40", bg: "bg-blue-400/10", text: "text-blue-600 dark:text-blue-400" },
  warning: { dot: "bg-amber-500", border: "border-amber-500/50", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  danger: { dot: "bg-red-500", border: "border-red-500/50", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
};

// Temperature config
const TEMP_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  quente: { icon: Flame, label: "Quente", color: "text-red-600", bg: "bg-red-500/10" },
  morno: { icon: Thermometer, label: "Morno", color: "text-amber-600", bg: "bg-amber-500/10" },
  frio: { icon: Snowflake, label: "Frio", color: "text-blue-500", bg: "bg-blue-500/10" },
};

const MODO_LABELS: Record<string, { label: string; color: string }> = {
  corretor_conduz: { label: "Corretor", color: "text-blue-600 bg-blue-500/10" },
  corretor_gerente: { label: "Cor + Ger", color: "text-purple-600 bg-purple-500/10" },
  gerente_conduz: { label: "Gerente", color: "text-amber-600 bg-amber-500/10" },
};

const PipelineCard = memo(function PipelineCard({ lead, stage, segmentos, corretorNome, gerenteNome, parceiroNome, onDragStart, onClick, onTransferred }: PipelineCardProps) {
  const [hovered, setHovered] = useState(false);
  const segmento = segmentos.find(s => s.id === lead.segmento_id);
  const activity = getActivityInfo(lead.stage_changed_at);
  const createdTime = getTimeSinceCreated(lead.created_at);
  const style = activityStyles[activity.variant];
  const temp = TEMP_CONFIG[(lead as any).temperatura || "morno"];
  const showAlert = activity.variant === "warning" || activity.variant === "danger";
  const leadScore = calculateLeadScore(lead as any);
  
  // SLA status
  const sla = stage ? getSlaStatus(stage.tipo, lead.stage_changed_at) : null;

  const handleWhatsApp = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(getWhatsAppUrl(phone), "_blank");
  };

  const handleCall = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    window.open(`tel:${phone}`, "_self");
  };

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
        className={`group relative rounded-xl border-l-[3px] border bg-card p-0 cursor-grab active:cursor-grabbing hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 select-none overflow-hidden ${style.border}`}
      >
        {/* Activity indicator bar */}
        <div className={`h-[2px] w-full ${style.dot}`} />

        <div className="p-3 space-y-2">
          {/* Name + Score + Temperature */}
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-[13px] font-bold text-foreground leading-tight line-clamp-1 flex-1">
              {lead.nome}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${leadScore.bgColor} ${leadScore.color}`}>
                    <Zap className="h-2.5 w-2.5 inline mr-0.5" />
                    {leadScore.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-semibold mb-1">Score: {leadScore.score}/100</p>
                  <p className="text-muted-foreground">{leadScore.factors.join(" · ")}</p>
                </TooltipContent>
              </Tooltip>
              {temp && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`p-0.5 rounded ${temp.bg}`}>
                      <temp.icon className={`h-3 w-3 ${temp.color}`} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{temp.label}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

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
                    className="p-0.5 rounded hover:bg-accent transition-colors"
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

          {/* Empreendimento */}
          {lead.empreendimento && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate font-medium">{lead.empreendimento}</span>
            </div>
          )}

          {/* VGV */}
          {lead.valor_estimado && lead.valor_estimado > 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              R$ {lead.valor_estimado.toLocaleString("pt-BR")}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/50 italic">Valor não informado</div>
          )}

          {/* SLA Badge */}
          {sla && sla.status !== "ok" && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${
              sla.status === "breach" 
                ? "bg-red-500/15 text-red-600 border border-red-300/50" 
                : "bg-amber-500/15 text-amber-600 border border-amber-300/50"
            }`}>
              {sla.status === "breach" ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Timer className="h-3 w-3" />
              )}
              {sla.status === "breach" ? "🚨 SLA estourado" : `⏱ SLA: ${formatSlaTime(sla.minutesRemaining)}`}
            </div>
          )}

          {/* Score badge */}
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${leadScore.bgColor} ${leadScore.color}`}>
            <Zap className="h-2.5 w-2.5" />
            Score {leadScore.score}
          </div>

          {/* Time indicators */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {createdTime}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Tempo desde criação</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`flex items-center gap-1 font-medium ${showAlert ? style.text : ""}`}>
                  <Hourglass className="h-2.5 w-2.5" />
                  {activity.timeText}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Tempo nesta etapa</TooltipContent>
            </Tooltip>
          </div>

          {/* Segmento tag + Origem */}
          {(segmento || (lead.origem && lead.origem !== lead.empreendimento)) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {segmento && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-none"
                  style={{ backgroundColor: segmento.cor }}
                >
                  {segmento.nome.length > 10 ? segmento.nome.split(" ")[0] : segmento.nome}
                </span>
              )}
              {lead.origem && lead.origem !== lead.empreendimento && (
                <span className="text-[10px] text-muted-foreground/60 truncate">
                  {lead.origem.replace(/_/g, " ")}
                </span>
              )}
            </div>
          )}

          {/* Footer: team info + alert */}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              {/* Corretor */}
              <div className="flex items-center gap-1 min-w-0">
                <Avatar className="h-4 w-4 text-[7px] border border-border/40 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-[7px]">
                    {corretorNome ? corretorNome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[9px] text-muted-foreground truncate max-w-[60px] font-medium">
                  {corretorNome || "Sem corretor"}
                </span>
              </div>
              {/* Parceiro */}
              {parceiroNome && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[9px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                      <Handshake className="h-2.5 w-2.5" />
                      {parceiroNome.split(" ")[0]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Parceiro: {parceiroNome}</TooltipContent>
                </Tooltip>
              )}
              {/* Gerente */}
              {gerenteNome && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <Shield className="h-2.5 w-2.5" />
                      {gerenteNome.split(" ")[0]}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Gerente: {gerenteNome}</TooltipContent>
                </Tooltip>
              )}
              {/* Modo */}
              {lead.modo_conducao && lead.modo_conducao !== "corretor_conduz" && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${MODO_LABELS[lead.modo_conducao]?.color || ""}`}>
                  {MODO_LABELS[lead.modo_conducao]?.label}
                </span>
              )}
            </div>

            {showAlert ? (
              <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border} shrink-0`}>
                <Calendar className="h-2.5 w-2.5" />
                {activity.variant === "warning" ? "30m+" : "2h+"}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} shrink-0`}>
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
                      className="p-1.5 rounded-md hover:bg-accent transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">WhatsApp</TooltipContent>
                </Tooltip>
              </>
            )}
            <div className="w-px h-4 bg-border mx-0.5" />
            <PipelineQuickTransfer
              leadId={lead.id}
              leadNome={lead.nome}
              currentCorretorId={lead.corretor_id}
              onTransferred={(corretorId, nome) => onTransferred?.(lead.id, corretorId, nome)}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;
