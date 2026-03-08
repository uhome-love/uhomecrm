import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MessageCircle, Calendar, Flame, Thermometer, Snowflake, Zap, AlertCircle, Timer, ChevronDown, MoreHorizontal, Eye, UserPlus, StickyNote, XCircle, Handshake, ArrowRightLeft } from "lucide-react";
import { differenceInHours, differenceInMinutes, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateLeadScore, getSlaStatus } from "@/lib/leadScoring";
import PipelineQuickTransfer from "./PipelineQuickTransfer";
import PartnershipDialog from "./PartnershipDialog";
import PipelineTransferDialog from "./PipelineTransferDialog";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function formatSlaTime(mins: number): string {
  const abs = Math.abs(mins);
  if (abs < 60) return `${abs}m`;
  if (abs < 1440) return `${Math.floor(abs / 60)}h`;
  return `${Math.floor(abs / 1440)}d`;
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55"))
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function getWhatsAppUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

/** Deduplicate empreendimento text (e.g. "Open Bosque (Video) · Open Bosque (X)" → "Open Bosque") */
function deduplicateEmpreendimento(raw: string): string {
  if (!raw) return "";
  // Split by common separators
  const parts = raw.split(/[·,;|]/).map(s => s.trim()).filter(Boolean);
  // Normalize: strip parenthetical suffixes for comparison
  const normalize = (s: string) => s.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
  const seen = new Map<string, string>();
  for (const part of parts) {
    const key = normalize(part);
    if (!seen.has(key)) {
      // Use the shortest clean version
      seen.set(key, part.replace(/\s*\(.*?\)\s*/g, "").trim());
    }
  }
  return [...seen.values()].join(" · ");
}

// Mission badges by stage type/name
const MISSION_BADGES: Record<string, { badge: string; color: string }> = {
  "Novo Lead":          { badge: "🗺️ EXPLORAR",    color: "#6B7280" },
  "Contato Iniciado":   { badge: "⚡ ENGAJAR",      color: "#3B82F6" },
  "Qualificação":       { badge: "🎯 QUALIFICAR",   color: "#8B5CF6" },
  "Possível Visita":    { badge: "🏃 AVANÇAR",      color: "#F59E0B" },
  "Visita Marcada":     { badge: "🔑 CONFIRMAR",    color: "#10B981" },
  "Visita Realizada":   { badge: "👑 FECHAR",       color: "#F97316" },
  "Descarte":           { badge: "💀 DESCARTE",     color: "#EF4444" },
};

function getMissionBadge(stageName: string) {
  return MISSION_BADGES[stageName] || { badge: "📍 MISSÃO", color: "#6B7280" };
}
const TEMP_BORDER: Record<string, string> = {
  quente: "border-l-red-500",
  morno: "border-l-amber-400",
  frio: "border-l-blue-400",
};

function getCalcTempBorder(lead: PipelineLead): string {
  const refDate = lead.updated_at || lead.created_at;
  const hours = differenceInHours(new Date(), new Date(refDate));
  const isIndicacao = (lead.origem || "").toLowerCase().includes("indicaç") || (lead.origem || "").toLowerCase().includes("indicac");
  if (hours < 2 || isIndicacao) return "border-l-red-500";
  if (hours < 24) return "border-l-amber-400";
  if (hours < 72) return "border-l-blue-400";
  return "border-l-muted-foreground/30";
}

function getCalcTempEmoji(lead: PipelineLead): string {
  const refDate = lead.updated_at || lead.created_at;
  const hours = differenceInHours(new Date(), new Date(refDate));
  const isIndicacao = (lead.origem || "").toLowerCase().includes("indicaç") || (lead.origem || "").toLowerCase().includes("indicac");
  if (hours < 2 || isIndicacao) return "🔥";
  if (hours < 24) return "🟡";
  if (hours < 72) return "🔵";
  return "❄️";
}

interface PipelineCardProps {
  lead: PipelineLead;
  stage?: PipelineStage;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  corretorNome?: string;
  gerenteNome?: string;
  parceiroNome?: string;
  onDragStart: () => void;
  onClick: () => void;
  onMoveLead?: (leadId: string, stageId: string) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
  stageIndexMap?: Map<string, number>;
}

const PipelineCard = memo(function PipelineCard({
  lead, stage, stages, segmentos, corretorNome, gerenteNome, parceiroNome,
  onDragStart, onClick, onMoveLead, onTransferred, stageIndexMap,
}: PipelineCardProps) {
  const { user } = useAuth();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);

  const tempBorder = lead.temperatura ? TEMP_BORDER[lead.temperatura] || getCalcTempBorder(lead) : getCalcTempBorder(lead);
  const tempEmoji = getCalcTempEmoji(lead);
  const leadScore = calculateLeadScore(lead as any);
  const sla = stage ? getSlaStatus(stage.tipo, lead.stage_changed_at) : null;
  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || "");
  const missionBadge = stage ? getMissionBadge(stage.nome) : getMissionBadge("");
  const daysInStage = differenceInDays(new Date(), new Date(lead.stage_changed_at));
  const currentIdx = stageIndexMap?.get(lead.stage_id) ?? 0;

  const daysLabel = useMemo(() => {
    if (daysInStage <= 2) return { text: `✅ ${daysInStage}d`, cls: "text-emerald-600 dark:text-emerald-400" };
    if (daysInStage <= 5) return { text: `⚠️ ${daysInStage}d`, cls: "text-amber-600 dark:text-amber-400" };
    return { text: `🔥 ${daysInStage}d`, cls: "text-red-600 dark:text-red-400" };
  }, [daysInStage]);

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.telefone) return;
    window.open(`tel:${lead.telefone}`, "_self");
    if (user) {
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "ligacao",
        titulo: "Ligação realizada",
        created_by: user.id,
      }).then(() => {});
      if (stage?.tipo === "novo_lead" && onMoveLead) {
        const contatoStage = stages.find(s => s.tipo === "atendimento" || s.nome.toLowerCase().includes("contato"));
        if (contatoStage) onMoveLead(lead.id, contatoStage.id);
      }
    }
    toast.success("📞 Ligação registrada");
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.telefone) return;
    window.open(getWhatsAppUrl(lead.telefone), "_blank");
    if (user) {
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "whatsapp",
        titulo: "WhatsApp enviado",
        created_by: user.id,
      }).then(() => {});
    }
    toast.success("💬 WhatsApp registrado");
  };

  const handleScheduleVisit = async () => {
    if (!scheduleDate || !user) return;
    const dateStr = format(scheduleDate, "yyyy-MM-dd");
    await supabase.from("visitas").insert({
      nome_cliente: lead.nome,
      data_visita: dateStr,
      hora_visita: scheduleTime,
      empreendimento: lead.empreendimento || "",
      corretor_id: lead.corretor_id || user.id,
      origem: "pipeline",
      status: "marcada",
      gerente_id: user.id,
      created_by: user.id,
      pipeline_lead_id: lead.id,
    });
    if (onMoveLead) {
      const visitaStage = stages.find(s => s.nome.toLowerCase().includes("visita marcada") || s.tipo === "visita");
      if (visitaStage) onMoveLead(lead.id, visitaStage.id);
    }
    setScheduleOpen(false);
    setScheduleDate(undefined);
    toast.success("📅 Visita agendada e lead movido");
  };

  const handleMoveStage = (e: React.MouseEvent, stageId: string) => {
    e.stopPropagation();
    if (!onMoveLead) return;
    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.nome.toLowerCase().includes("visita marcada")) {
      setScheduleOpen(true);
      return;
    }
    onMoveLead(lead.id, stageId);
    toast.success(`Lead movido para ${targetStage?.nome}`);
  };

  const handleAddNote = async () => {
    const note = prompt("Observação:");
    if (!note || !user) return;
    await supabase.from("pipeline_anotacoes").insert({
      pipeline_lead_id: lead.id,
      conteudo: note,
      autor_id: user.id,
      autor_nome: corretorNome || "Gerente",
    });
    toast.success("📝 Observação registrada");
  };

  const handleMarkLost = async () => {
    if (!user || !onMoveLead) return;
    const motivo = prompt("Motivo do descarte:");
    if (!motivo) return;
    const descarteStage = stages.find(s => s.tipo === "descarte");
    if (descarteStage) {
      await supabase.from("pipeline_leads").update({ motivo_descarte: motivo }).eq("id", lead.id);
      onMoveLead(lead.id, descarteStage.id);
      toast.info("Lead movido para Descarte");
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open detail if clicking on action buttons area
    const target = e.target as HTMLElement;
    if (target.closest("[data-actions-area]")) return;
    onClick();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onClick={handleCardClick}
        className={`group relative rounded-lg border-l-[3px] border bg-card cursor-pointer active:cursor-grabbing hover:bg-accent/40 transition-all duration-150 select-none overflow-hidden ${tempBorder}`}
      >
        {/* Info section */}
        <div className="px-3 pt-2.5 pb-2 space-y-1">
          {/* Game: Mission badge + days counter */}
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${missionBadge.color}20`, color: missionBadge.color }}
            >
              {missionBadge.badge}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-[10px] font-bold ${daysLabel.cls}`}>
                  {daysLabel.text}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Lead parado há {daysInStage} dias nesta fase
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Line 1: emoji + name + score */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-xs">{tempEmoji}</span>
              <span className="text-[13px] font-bold text-foreground truncate">{lead.nome}</span>
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${leadScore.bgColor} ${leadScore.color}`}>
              {leadScore.score}
            </span>
          </div>

          {/* Line 2: empreendimento · origem */}
          <div className="text-[11px] text-muted-foreground truncate">
            {displayEmpreendimento && <span className="font-medium">{displayEmpreendimento}</span>}
            {displayEmpreendimento && lead.origem && " · "}
            {lead.origem && <span>{lead.origem.replace(/_/g, " ")}</span>}
          </div>

          {/* Line 3: phone + email */}
          {(lead.telefone || lead.email) && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {lead.telefone && <span>{formatPhone(lead.telefone)}</span>}
              {lead.email && (
                <span className="truncate flex items-center gap-0.5">
                  <Mail className="h-2.5 w-2.5" />
                  {lead.email}
                </span>
              )}
            </div>
          )}

          {/* Line 4: SLA + corretor + parceria badge */}
          <div className="flex items-center justify-between gap-2">
            {sla && sla.status !== "ok" ? (
              <span className={`flex items-center gap-1 text-[10px] font-bold ${
                sla.status === "breach" ? "text-red-600" : "text-amber-600"
              }`}>
                {sla.status === "breach" ? <AlertCircle className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                {sla.status === "breach" ? `🚨 SLA ${formatSlaTime(sla.minutesRemaining)}` : `⏱ ${formatSlaTime(sla.minutesRemaining)}`}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {(() => {
                  const mins = differenceInMinutes(new Date(), new Date(lead.stage_changed_at));
                  if (mins < 60) return `${mins}m nesta etapa`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h nesta etapa`;
                  return `${Math.floor(hrs / 24)}d nesta etapa`;
                })()}
              </span>
            )}
            <div className="flex items-center gap-1">
              {parceiroNome && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 h-4">
                  <Handshake className="h-2.5 w-2.5" /> Parceria
                </Badge>
              )}
              {!corretorNome ? (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-none font-semibold">
                  📥 Fila CEO
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
                  👤 {corretorNome}
                </span>
              )}
            </div>
          </div>

          {/* Game: Journey progress dots + module indicator */}
          {stageIndexMap && (
            <div className="flex items-center gap-0.5 pt-1">
              {stages.map((s, i) => {
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                return (
                  <div key={s.id} className="flex items-center">
                    <div
                      className="rounded-full"
                      style={{
                        width: isCurrent ? 8 : 6,
                        height: isCurrent ? 8 : 6,
                        backgroundColor: isPast || isCurrent ? (missionBadge.color) : "hsl(var(--muted))",
                        opacity: isPast ? 0.5 : 1,
                        animation: isCurrent ? "pulseDot 2s ease-in-out infinite" : undefined,
                      }}
                    />
                    {i < stages.length - 1 && (
                      <div
                        className="h-[2px]"
                        style={{
                          width: "8px",
                          backgroundColor: isPast ? `${missionBadge.color}60` : "hsl(var(--muted))",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Actions section */}
        <div data-actions-area className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
          {/* Ligar ou Atribuir */}
          {!corretorNome ? (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-purple-600 hover:text-purple-700 font-semibold" onClick={(e) => { e.stopPropagation(); setTransferOpen(true); }}>
              <UserPlus className="h-3 w-3" /> 👤 Atribuir Corretor
            </Button>
          ) : lead.telefone ? (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={handleCall}>
              <Phone className="h-3 w-3" /> Ligar
            </Button>
          ) : null}

          {/* Comunicar */}
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-blue-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); setComunicacaoOpen(true); }}>
            <MessageCircle className="h-3 w-3" /> 💬 Comunicar
          </Button>

          {/* Agendar Visita */}
          <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={(e) => e.stopPropagation()}>
                <Calendar className="h-3 w-3" /> Agendar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-2" align="start" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-semibold">Agendar visita</p>
              <CalendarPicker
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                className={cn("p-2 pointer-events-auto")}
                locale={ptBR}
              />
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="text-[10px] text-muted-foreground">
                {lead.empreendimento || "Sem empreendimento"}
              </div>
              <Button size="sm" className="w-full h-7 text-xs" disabled={!scheduleDate} onClick={handleScheduleVisit}>
                Confirmar visita
              </Button>
            </PopoverContent>
          </Popover>

          {/* Mover etapa */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                Mover <ChevronDown className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]" onClick={(e) => e.stopPropagation()}>
              {stages.filter(s => s.id !== lead.stage_id).map(s => (
                <DropdownMenuItem key={s.id} onClick={(e) => handleMoveStage(e as any, s.id)} className="text-xs gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                  {s.nome}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mais */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPartnerOpen(true); }} className="text-xs gap-2">
                <Handshake className="h-3.5 w-3.5" /> Fazer parceria
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTransferOpen(true); }} className="text-xs gap-2">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Repassar lead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClick} className="text-xs gap-2">
                <Eye className="h-3.5 w-3.5" /> Ver lead completo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAddNote(); }} className="text-xs gap-2">
                <StickyNote className="h-3.5 w-3.5" /> Registrar observação
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkLost(); }} className="text-xs gap-2 text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Marcar sem interesse
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Dialogs */}
        <PartnershipDialog
          open={partnerOpen}
          onOpenChange={setPartnerOpen}
          leadId={lead.id}
          leadNome={lead.nome}
          corretorPrincipalId={lead.corretor_id}
        />
        <PipelineTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          leadId={lead.id}
          leadNome={lead.nome}
          currentCorretorId={lead.corretor_id}
          stages={stages}
          onTransferred={(corretorId, nome) => onTransferred?.(lead.id, corretorId, nome)}
        />
        <CentralComunicacao
          open={comunicacaoOpen}
          onOpenChange={setComunicacaoOpen}
          leadId={lead.id}
          leadNome={lead.nome}
          leadEmpreendimento={lead.empreendimento}
        />
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;