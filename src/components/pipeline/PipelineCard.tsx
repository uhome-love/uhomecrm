import { memo, useState } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MessageCircle, Calendar, Flame, Thermometer, Snowflake, Zap, AlertCircle, Timer, ChevronDown, MoreHorizontal, Eye, UserPlus, StickyNote, XCircle } from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateLeadScore, getSlaStatus } from "@/lib/leadScoring";
import PipelineQuickTransfer from "./PipelineQuickTransfer";
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

// Temperature border colors
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
}

const PipelineCard = memo(function PipelineCard({
  lead, stage, stages, segmentos, corretorNome, gerenteNome, parceiroNome,
  onDragStart, onClick, onMoveLead, onTransferred,
}: PipelineCardProps) {
  const { user } = useAuth();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("10:00");

  const tempBorder = lead.temperatura ? TEMP_BORDER[lead.temperatura] || getCalcTempBorder(lead) : getCalcTempBorder(lead);
  const tempEmoji = getCalcTempEmoji(lead);
  const leadScore = calculateLeadScore(lead as any);
  const sla = stage ? getSlaStatus(stage.tipo, lead.stage_changed_at) : null;

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.telefone) return;
    window.open(`tel:${lead.telefone}`, "_self");
    // Register activity
    if (user) {
      supabase.from("pipeline_atividades").insert({
        pipeline_lead_id: lead.id,
        tipo: "ligacao",
        titulo: "Ligação realizada",
        created_by: user.id,
      }).then(() => {});
      // Move to "Contato Iniciado" if "Novo Lead"
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
    // Create visita
    await supabase.from("visitas").insert({
      nome_cliente: lead.nome,
      data_visita: dateStr,
      hora_visita: scheduleTime,
      empreendimento: lead.empreendimento || "",
      corretor_id: lead.corretor_id || user.id,
      corretor_nome: corretorNome || "",
      origem: "pipeline",
      status: "marcada",
      gerente_id: user.id,
      pipeline_lead_id: lead.id,
    });
    // Move lead to "Visita Marcada"
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
    // If moving to visita stage, open schedule instead
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

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        className={`group relative rounded-lg border-l-[3px] border bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-150 select-none overflow-hidden ${tempBorder}`}
      >
        {/* Info section */}
        <div className="px-3 pt-2.5 pb-2 space-y-1">
          {/* Line 1: emoji + name + score */}
          <div className="flex items-center justify-between gap-1">
            <button onClick={onClick} className="flex items-center gap-1 min-w-0 hover:underline">
              <span className="text-xs">{tempEmoji}</span>
              <span className="text-[13px] font-bold text-foreground truncate">{lead.nome}</span>
            </button>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${leadScore.bgColor} ${leadScore.color}`}>
              {leadScore.score}
            </span>
          </div>

          {/* Line 2: empreendimento · origem */}
          <div className="text-[11px] text-muted-foreground truncate">
            {lead.empreendimento && <span className="font-medium">{lead.empreendimento}</span>}
            {lead.empreendimento && lead.origem && " · "}
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

          {/* Line 4: SLA + corretor */}
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
            <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
              👤 {corretorNome || "Sem corretor"}
            </span>
          </div>
        </div>

        <Separator />

        {/* Actions section */}
        <div className="px-2 py-1.5 flex items-center gap-1 flex-wrap">
          {/* Ligar */}
          {lead.telefone && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={handleCall}>
              <Phone className="h-3 w-3" /> Ligar
            </Button>
          )}

          {/* WhatsApp */}
          {lead.telefone && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-green-600 hover:text-green-700" onClick={handleWhatsApp}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
          )}

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
              <DropdownMenuItem onClick={onClick} className="text-xs gap-2">
                <Eye className="h-3.5 w-3.5" /> Ver lead completo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-xs gap-2 p-0">
                <div className="w-full">
                  <PipelineQuickTransfer
                    leadId={lead.id}
                    leadNome={lead.nome}
                    currentCorretorId={lead.corretor_id}
                    onTransferred={(corretorId, nome) => onTransferred?.(lead.id, corretorId, nome)}
                  />
                </div>
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
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;
