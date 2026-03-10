import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, MessageCircle, Zap, Calendar, UserPlus, StickyNote, XCircle, Handshake, ArrowRightLeft, Eye, MapPin, PhoneCall, Send, FileText, Mail, MoreVertical, ArrowRight, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { differenceInHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PartnershipDialog from "./PartnershipDialog";
import PipelineTransferDialog from "./PipelineTransferDialog";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";
import QuickActionMenu from "./QuickActionMenu";
import { format, isToday as isTodayFn, isTomorrow as isTomorrowFn, isYesterday as isYesterdayFn, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

function deduplicateEmpreendimento(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(/[·,;|]/).map(s => s.trim()).filter(Boolean);
  const normalize = (s: string) => s.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
  const seen = new Map<string, string>();
  for (const part of parts) {
    const key = normalize(part);
    if (!seen.has(key)) {
      seen.set(key, part.replace(/\s*\(.*?\)\s*/g, "").trim());
    }
  }
  return [...seen.values()].join(" · ");
}

function cleanName(name: string) {
  if (!name) return "";
  const half = Math.floor(name.length / 2);
  const firstHalf = name.substring(0, half).trim();
  const secondHalf = name.substring(half).trim();
  if (firstHalf === secondHalf) return firstHalf;
  return name;
}

const TIPO_LABELS: Record<string, string> = {
  follow_up: "Follow-up", ligar: "Ligar", whatsapp: "WhatsApp",
  enviar_proposta: "Proposta", enviar_material: "Material",
  marcar_visita: "Visita", confirmar_visita: "Confirmar visita",
  retornar_cliente: "Retornar", outro: "Tarefa",
};

// Status indicator + task status line
function getCardStatus(lead: PipelineLead, proximaTarefa: { tipo: string; vence_em: string | null; hora_vencimento: string | null } | null) {
  const now = new Date();
  const todayStart = startOfDay(now);

  // Check task status
  if (proximaTarefa?.vence_em) {
    const d = new Date(proximaTarefa.vence_em + "T12:00:00");
    const hora = proximaTarefa.hora_vencimento?.slice(0, 5) || "";
    const label = TIPO_LABELS[proximaTarefa.tipo] || proximaTarefa.tipo;

    if (d < todayStart) {
      // Overdue
      const dateLabel = isYesterdayFn(d) ? "ontem" : format(d, "dd/MM");
      return {
        indicator: "🔴",
        indicatorCls: "text-destructive",
        text: `🔴 Atrasado: ${label} ${dateLabel} ${hora}`,
        textCls: "text-destructive font-semibold",
        borderCls: "border-l-destructive",
      };
    }
    if (isTodayFn(d)) {
      return {
        indicator: "🟡",
        indicatorCls: "text-amber-500",
        text: `🟡 Hoje ${hora}: ${label}`,
        textCls: "text-amber-600 dark:text-amber-400 font-semibold",
        borderCls: "border-l-amber-400",
      };
    }
    // Future
    const dateLabel = isTomorrowFn(d) ? "amanhã" : format(d, "dd/MM");
    return {
      indicator: "✅",
      indicatorCls: "text-green-500",
      text: `✅ Próximo: ${label} ${dateLabel} ${hora}`,
      textCls: "text-muted-foreground",
      borderCls: "border-l-green-400",
    };
  }

  // No task — check contact status
  const lastContact = (lead as any).ultima_acao_at;
  if (!lastContact) {
    // Check if new lead (< 2h in stage)
    const hoursInStage = differenceInHours(now, new Date(lead.stage_changed_at));
    if (hoursInStage < 2) {
      return {
        indicator: null,
        indicatorCls: "",
        text: "",
        textCls: "",
        borderCls: "border-l-blue-400",
      };
    }
    return {
      indicator: "🟡",
      indicatorCls: "text-amber-500",
      text: "🟡 Sem contato · Aguardando ação",
      textCls: "text-amber-600 dark:text-amber-400 font-semibold",
      borderCls: "border-l-amber-400",
    };
  }

  const hoursSinceContact = differenceInHours(now, new Date(lastContact));
  if (hoursSinceContact > 48) {
    return {
      indicator: "🔴",
      indicatorCls: "text-destructive",
      text: "🔴 Sem contato · Aguardando ação",
      textCls: "text-destructive font-semibold",
      borderCls: "border-l-destructive",
    };
  }
  if (hoursSinceContact > 24) {
    return {
      indicator: "🟡",
      indicatorCls: "text-amber-500",
      text: "🟡 Sem contato · Aguardando ação",
      textCls: "text-amber-600 dark:text-amber-400 font-semibold",
      borderCls: "border-l-amber-400",
    };
  }

  // Recent contact, no task
  const contactLabel = isTodayFn(new Date(lastContact))
    ? `hoje ${format(new Date(lastContact), "HH:mm")}`
    : isYesterdayFn(new Date(lastContact))
    ? "ontem"
    : format(new Date(lastContact), "dd/MM");
  return {
    indicator: null,
    indicatorCls: "",
    text: `Último contato: ${contactLabel}`,
    textCls: "text-muted-foreground",
    borderCls: "border-l-muted-foreground/30",
  };
}

interface ProximaTarefa {
  tipo: string;
  vence_em: string | null;
  hora_vencimento: string | null;
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
  proximaTarefa?: ProximaTarefa | null;
}

const PipelineCard = memo(function PipelineCard({
  lead, stage, stages, segmentos, corretorNome, gerenteNome, parceiroNome,
  onDragStart, onClick, onMoveLead, onTransferred, stageIndexMap, proximaTarefa,
}: PipelineCardProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappTemplatesOpen, setWhatsappTemplatesOpen] = useState(false);

  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || (lead as any).origem_detalhe || "");
  const status = useMemo(() => getCardStatus(lead, proximaTarefa || null), [(lead as any).ultima_acao_at, lead.stage_changed_at, proximaTarefa]);

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
      // Update ultima_acao_at
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any).eq("id", lead.id).then(() => {});
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
    setWhatsappTemplatesOpen(true);
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
    const target = e.target as HTMLElement;
    if (target.closest("[data-actions-area]") || target.closest("[data-no-card-click]")) return;
    if (comunicacaoOpen) return;
    onClick();
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lead.id);
        const el = e.currentTarget;
        if (el) e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
        onDragStart();
      }}
      onDragEnd={(e) => e.preventDefault()}
      onClick={handleCardClick}
      className={cn(
        "group relative rounded-lg border-l-[3px] border border-border/60 bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-150 select-none overflow-hidden",
        status.borderCls
      )}
    >
      {/* Content */}
      <div className="px-3 pt-2.5 pb-2 space-y-1">
        {/* Line 1: Name + status indicator */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-foreground truncate leading-tight">
            {cleanName(lead.nome)}
          </span>
          {status.indicator && (
            <span className={cn("text-sm shrink-0", status.indicatorCls)}>
              {status.indicator}
            </span>
          )}
        </div>

        {/* Line 2: Empreendimento · Phone */}
        <div className="text-xs text-muted-foreground truncate leading-tight">
          {displayEmpreendimento ? (
            <span className="font-medium text-foreground/70">{displayEmpreendimento}</span>
          ) : (
            <span className="text-amber-500/80 font-medium">🏠 Sem empreend.</span>
          )}
          {lead.telefone && <span> · {formatPhone(lead.telefone)}</span>}
        </div>

        {/* Line 3: Task status — always show something */}
        <p className={cn("text-[11px] truncate pt-0.5", status.text ? status.textCls : "text-muted-foreground")}>
          {status.text || "✅ Em dia"}
        </p>
      </div>

      <div className="h-px bg-border/40" />

      {/* Line 4: Action buttons + 3-dot menu */}
      <div data-actions-area className="px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {lead.telefone && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 gap-1 font-medium hover:bg-accent"
              onClick={handleCall}
            >
              <Phone className="h-3 w-3" /> Ligar
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] px-2 gap-1 font-medium text-green-600 dark:text-green-400 hover:bg-green-500/10"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </Button>

          <QuickActionMenu
            leadId={lead.id}
            leadNome={lead.nome}
            onOpenDetail={onClick}
            onScheduleVisit={() => setScheduleOpen(true)}
          >
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 gap-1 font-medium text-primary hover:bg-primary/10"
            >
              <Zap className="h-3 w-3" /> Ação
            </Button>
          </QuickActionMenu>
        </div>

        {/* 3-dot quick actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-accent" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            {onMoveLead && stages.filter(s => s.id !== lead.stage_id).slice(0, 5).map(s => (
              <DropdownMenuItem key={s.id} onClick={(e) => handleMoveStage(e as any, s.id)}>
                <ArrowRight className="h-3.5 w-3.5 mr-2" /> {s.nome}
              </DropdownMenuItem>
            ))}
            {onMoveLead && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setScheduleOpen(true); }}>
              <Calendar className="h-3.5 w-3.5 mr-2" /> Agendar visita
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setComunicacaoOpen(true); }}>
              <Send className="h-3.5 w-3.5 mr-2" /> Central de comunicação
            </DropdownMenuItem>
            {(isAdmin || lead.corretor_id === user?.id) && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTransferOpen(true); }}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Repassar lead
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPartnerOpen(true); }}>
              <Handshake className="h-3.5 w-3.5 mr-2" /> Parceria
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleMarkLost(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Descartar lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
          <DialogContent className="max-w-[320px] p-4 gap-3">
            <DialogHeader className="p-0 mb-1">
              <DialogTitle className="text-sm font-semibold">Agendar visita</DialogTitle>
            </DialogHeader>
            <CalendarPicker
              mode="single"
              selected={scheduleDate}
              onSelect={setScheduleDate}
              className={cn("p-0 mx-auto pointer-events-auto border rounded-md")}
              locale={ptBR}
            />
            <div className="space-y-1.5 mt-2">
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="h-8 text-xs w-full"
              />
              <div className="text-[10px] text-muted-foreground truncate">
                {lead.empreendimento || "Sem empreendimento"}
              </div>
              <Button size="sm" className="w-full h-8 text-xs mt-1" disabled={!scheduleDate} onClick={handleScheduleVisit}>
                Confirmar visita
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {partnerOpen && (
          <PartnershipDialog
            open={partnerOpen}
            onOpenChange={setPartnerOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            corretorPrincipalId={lead.corretor_id}
          />
        )}
        {transferOpen && (
          <PipelineTransferDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            currentCorretorId={lead.corretor_id}
            stages={stages}
            onTransferred={(corretorId, nome) => onTransferred?.(lead.id, corretorId, nome)}
          />
        )}
        {comunicacaoOpen && (
          <CentralComunicacao
            open={comunicacaoOpen}
            onOpenChange={setComunicacaoOpen}
            leadId={lead.id}
            leadNome={lead.nome}
            leadTelefone={lead.telefone}
            leadEmpreendimento={lead.empreendimento}
          />
        )}
        <WhatsAppTemplatesDialog
          open={whatsappTemplatesOpen}
          onOpenChange={setWhatsappTemplatesOpen}
          leadNome={lead.nome}
          leadTelefone={lead.telefone}
          leadEmpreendimento={lead.empreendimento}
          leadId={lead.id}
          corretorNome={corretorNome}
        />
      </div>
    </div>
  );
});

export default PipelineCard;
