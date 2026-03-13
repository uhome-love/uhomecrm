import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, MessageCircle, Zap, Calendar, UserPlus, StickyNote, XCircle, Handshake, ArrowRightLeft, Eye, MapPin, PhoneCall, Send, FileText, Mail, MoreVertical, ArrowRight, Trash2, Flame, Snowflake, ThermometerSun, ClipboardList, Loader2 } from "lucide-react";
import { calculateLeadScore } from "@/lib/leadScoring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRole } from "@/hooks/useUserRole";
import { differenceInHours, differenceInDays } from "date-fns";
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

// Status indicator + task status line
function getCardStatus(lead: PipelineLead, proximaTarefa: { tipo: string; vence_em: string | null; hora_vencimento: string | null } | null) {
  const now = new Date();
  const todayStart = startOfDay(now);

  // Check task status
  if (proximaTarefa?.vence_em) {
    const d = toValidDateFromYMD(proximaTarefa.vence_em);
    const hora = proximaTarefa.hora_vencimento?.slice(0, 5) || "";
    const label = TIPO_LABELS[proximaTarefa.tipo] || proximaTarefa.tipo;

    if (!d) {
      return {
        indicator: "🟡",
        indicatorCls: "text-amber-500",
        text: `🟡 Próximo: ${label} ${hora}`.trim(),
        textCls: "text-amber-600 dark:text-amber-400 font-semibold",
        borderCls: "border-l-amber-400",
      };
    }

    if (d < todayStart) {
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
  const lastContactDate = toValidDate((lead as any).ultima_acao_at);
  if (!lastContactDate) {
    const stageDate = toValidDate(lead.stage_changed_at);
    const hoursInStage = stageDate ? differenceInHours(now, stageDate) : 999;

    if (Number.isFinite(hoursInStage) && hoursInStage < 2) {
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

  const hoursSinceContact = differenceInHours(now, lastContactDate);
  if (!Number.isFinite(hoursSinceContact)) {
    return {
      indicator: "🟡",
      indicatorCls: "text-amber-500",
      text: "🟡 Sem contato · Aguardando ação",
      textCls: "text-amber-600 dark:text-amber-400 font-semibold",
      borderCls: "border-l-amber-400",
    };
  }

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

  // Recent contact, no task → DESATUALIZADO
  return {
    indicator: "⚠️",
    indicatorCls: "text-amber-500",
    text: `⚠️ Desatualizado · falta tarefa`,
    textCls: "text-amber-600 dark:text-amber-400 font-semibold",
    borderCls: "border-l-amber-400",
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
  corretorAvatar?: string;
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
  lead, stage, stages, segmentos, corretorNome, corretorAvatar, gerenteNome, parceiroNome,
  onDragStart, onClick, onMoveLead, onTransferred, stageIndexMap, proximaTarefa,
}: PipelineCardProps) {
  const { user } = useAuth();
  const { isAdmin, isGestor } = useUserRole();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappTemplatesOpen, setWhatsappTemplatesOpen] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [scheduleObs, setScheduleObs] = useState("");
  const [criandoNegocio, setCriandoNegocio] = useState(false);
  const [negocioCriado, setNegocioCriado] = useState(false);

  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || (lead as any).origem_detalhe || "");
  const status = useMemo(() => getCardStatus(lead, proximaTarefa || null), [(lead as any).ultima_acao_at, lead.stage_changed_at, proximaTarefa?.tipo, proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento]);

  // Lead scoring
  const leadScore = useMemo(() => calculateLeadScore({
    telefone: lead.telefone,
    email: lead.email,
    empreendimento: lead.empreendimento,
    valor_estimado: lead.valor_estimado,
    origem: lead.origem,
    temperatura: lead.temperatura,
    created_at: lead.created_at,
    stage_changed_at: lead.stage_changed_at,
  }), [lead.telefone, lead.email, lead.empreendimento, lead.valor_estimado, lead.origem, lead.temperatura, lead.created_at, lead.stage_changed_at]);

  // Temperature config
  const tempConfig = useMemo(() => {
    const t = lead.temperatura;
    if (t === "quente") return { icon: Flame, cls: "text-orange-500", bg: "bg-orange-500/10", label: "Quente" };
    if (t === "morno") return { icon: ThermometerSun, cls: "text-amber-500", bg: "bg-amber-500/10", label: "Morno" };
    if (t === "frio") return { icon: Snowflake, cls: "text-blue-400", bg: "bg-blue-400/10", label: "Frio" };
    return null;
  }, [lead.temperatura]);

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
      local_visita: scheduleLocal || null,
      observacoes: scheduleObs || null,
    });
    if (onMoveLead) {
      const visitaStage = stages.find(s => s.nome.toLowerCase().includes("visita marcada") || s.tipo === "visita");
      if (visitaStage) onMoveLead(lead.id, visitaStage.id);
    }
    setScheduleOpen(false);
    setScheduleDate(undefined);
    setScheduleLocal("");
    setScheduleObs("");
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
        "group relative rounded-xl border-l-[3px] border border-border/40 bg-card cursor-grab active:cursor-grabbing",
        "hover:shadow-lg hover:shadow-primary/5 hover:border-border/60 hover:-translate-y-[1px]",
        "transition-all duration-200 select-none overflow-hidden",
        status.borderCls
      )}
    >
      {/* Content */}
      <div className="px-3 pt-3 pb-2 space-y-1.5">
        {/* Line 1: Name + score badge + temperature */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-bold text-foreground truncate leading-tight tracking-tight">
            {cleanName(lead.nome)}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Temperature indicator */}
            {tempConfig && (
              <span className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold", tempConfig.bg, tempConfig.cls)}>
                <tempConfig.icon className="h-2.5 w-2.5" />
              </span>
            )}
            {/* Lead Score badge */}
            <span className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded text-[10px] font-black",
              leadScore.bgColor, leadScore.color
            )}>
              {leadScore.label}
            </span>
            {status.indicator && (
              <span className={cn("text-sm", status.indicatorCls)}>
                {status.indicator}
              </span>
            )}
          </div>
        </div>

        {/* Line 2: Corretor (for managers) + Empreendimento · Phone · Origin badge */}
        {corretorNome && (
          <div className="text-[11px] text-muted-foreground truncate leading-tight flex items-center gap-1.5">
            <Avatar className="h-4 w-4 shrink-0 ring-1 ring-primary/20">
              <AvatarImage src={corretorAvatar} className="object-cover" />
              <AvatarFallback className="text-[7px] bg-primary/15 text-primary font-bold">{corretorNome[0]}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-semibold text-primary truncate">{corretorNome.split(" ").slice(0, 2).join(" ")}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground truncate leading-tight flex items-center gap-1">
          <span className="truncate">
            {displayEmpreendimento ? (
              <span className="font-semibold text-foreground/80">{displayEmpreendimento}</span>
            ) : (
              <span className="text-amber-500/80 font-medium">🏠 Sem empreend.</span>
            )}
            {lead.telefone && <span className="text-muted-foreground"> · {formatPhone(lead.telefone)}</span>}
          </span>
          {lead.origem?.toLowerCase().includes("oferta") && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-violet-500/15 text-violet-500 dark:text-violet-400 border border-violet-500/20">
              OA
            </span>
          )}
        </div>

        {/* Partnership badge */}
        {parceiroNome && (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <Handshake className="h-3 w-3" /> Parceria: {parceiroNome.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        )}

        {/* Negócio criado badge */}
        {lead.negocio_id && (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">✅ Negócio criado</span>
          </div>
        )}

        {/* Line 3: Task status + days in stage */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <p className={cn("text-[11px] truncate font-medium", status.text ? status.textCls : "text-muted-foreground")}>
            {status.text || "✅ Em dia"}
          </p>
          {(() => {
            const stageChangedDate = toValidDate(lead.stage_changed_at);
            if (!stageChangedDate) return null;

            const days = differenceInDays(new Date(), stageChangedDate);
            if (!Number.isFinite(days) || days < 1) return null;

            return (
              <span className={cn(
                "text-[9px] font-semibold shrink-0 px-1.5 py-0.5 rounded-md",
                days >= 7 ? "text-destructive bg-destructive/10" :
                days >= 3 ? "text-amber-600 dark:text-amber-400 bg-amber-500/10" :
                "text-muted-foreground bg-muted/50"
              )}>
                {days}d na etapa
              </span>
            );
          })()}
        </div>
      </div>

      {/* Create Negócio button — only on Visita Realizada without linked deal */}
      {stage?.nome?.toLowerCase().includes("visita realizada") && !lead.negocio_id && !negocioCriado && (
        <div data-actions-area className="px-3 pb-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={criandoNegocio}
            className="w-full h-7 text-[11px] gap-1.5 font-semibold border-green-500/40 text-green-600 dark:text-green-400 hover:bg-green-500/10"
            onClick={async (e) => {
              e.stopPropagation();
              if (!user || criandoNegocio) return;
              setCriandoNegocio(true);
              try {
                const corretorUserId = lead.corretor_id;
                const gerenteUserId = lead.gerente_id || user.id;
                const { data: profileRows } = await supabase
                  .from("profiles")
                  .select("id, user_id")
                  .in("user_id", [corretorUserId, gerenteUserId].filter(Boolean) as string[]);
                const profileMap = new Map((profileRows || []).map(p => [p.user_id, p.id]));

                const { data: negocio, error } = await supabase
                  .from("negocios")
                  .insert({
                    nome_cliente: lead.nome,
                    pipeline_lead_id: lead.id,
                    corretor_id: corretorUserId ? profileMap.get(corretorUserId) || null : null,
                    gerente_id: profileMap.get(gerenteUserId) || null,
                    empreendimento: lead.empreendimento || null,
                    telefone: lead.telefone || null,
                    fase: "novo_negocio",
                    origem: "visita_realizada",
                    vgv_estimado: lead.valor_estimado || null,
                  })
                  .select("id")
                  .single();
                if (error) throw error;
                if (negocio) {
                  await supabase.from("pipeline_leads").update({ negocio_id: negocio.id } as any).eq("id", lead.id);
                  setNegocioCriado(true);
                  toast.success(`🎉 Negócio criado para ${lead.nome}!`, { description: "🎯 Lead será movido para Convertidos" });
                  // Move to Convertido immediately
                  const convertidoStage = stages.find(s => s.tipo === "convertido");
                  if (convertidoStage && onMoveLead) {
                    onMoveLead(lead.id, convertidoStage.id);
                  }
                }
              } catch (err: any) {
                console.error("Erro ao criar negócio:", err);
                toast.error("Erro ao criar negócio: " + (err?.message || "Erro desconhecido"));
              } finally {
                setCriandoNegocio(false);
              }
            }}
          >
            {criandoNegocio ? (
              <><span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Criando...</>
            ) : (
              <><FileText className="h-3 w-3" /> Criar Negócio</>
            )}
          </Button>
        </div>
      )}

      {/* Show success state after negócio created */}
      {negocioCriado && (
        <div data-actions-area className="px-3 pb-1.5">
          <div className="w-full h-7 flex items-center justify-center text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-500/10 rounded-md">
            ✅ Negócio criado com sucesso!
          </div>
        </div>
      )}

      {/* Convertido stage — show "Voltar para Pipeline" button */}
      {stage?.tipo === "convertido" && (
        <div data-actions-area className="px-3 pb-1.5 space-y-1">
          <div className="text-[10px] text-muted-foreground text-center">🎯 Negócio em andamento</div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[11px] gap-1.5 font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={(e) => {
              e.stopPropagation();
              if (!onMoveLead) return;
              // Move back to Qualificação by default
              const qualStage = stages.find(s => s.nome.toLowerCase().includes("qualifica"));
              if (qualStage) {
                onMoveLead(lead.id, qualStage.id);
                // Clear negocio_id
                supabase.from("pipeline_leads").update({ negocio_id: null } as any).eq("id", lead.id).then(() => {});
                toast.success("🔄 Lead retornado ao Pipeline");
              }
            }}
          >
            <ArrowRightLeft className="h-3 w-3" /> Voltar para Pipeline
          </Button>
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

      {/* Line 4: Action buttons + 3-dot menu */}
      <div data-actions-area className="px-2.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          {lead.telefone && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2.5 gap-1.5 font-semibold text-foreground/80 hover:bg-accent hover:text-foreground rounded-lg"
              onClick={handleCall}
            >
              <Phone className="h-3.5 w-3.5" /> Ligar
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] px-2.5 gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
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
              className="h-7 text-[11px] px-2.5 gap-1.5 font-semibold text-primary hover:bg-primary/10 rounded-lg"
            >
              <Zap className="h-3.5 w-3.5" /> Ação
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
            {(isAdmin || isGestor || lead.corretor_id === user?.id) && (
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
          <DialogContent className="max-w-[360px] p-5 gap-4">
            <DialogHeader className="p-0 mb-1">
              <DialogTitle className="text-base font-semibold">📅 Agendar Visita</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{cleanName(lead.nome)}</p>
            </DialogHeader>
            <CalendarPicker
              mode="single"
              selected={scheduleDate}
              onSelect={setScheduleDate}
              className={cn("p-0 mx-auto pointer-events-auto border rounded-md")}
              locale={ptBR}
              disabled={(date) => date < startOfDay(new Date())}
            />
            <div className="space-y-3 mt-1">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Horário</label>
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-9 text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Empreendimento</label>
                <div className="text-sm font-medium text-foreground">
                  {lead.empreendimento || <span className="text-amber-500">Sem empreendimento definido</span>}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Local da visita (opcional)</label>
                <Input
                  placeholder="Ex: Stand do empreendimento, sala 3..."
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Observações (opcional)</label>
                <Input
                  placeholder="Ex: Cliente prefere período da tarde..."
                  value={scheduleObs}
                  onChange={(e) => setScheduleObs(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button className="w-full h-9 text-sm font-semibold mt-1" disabled={!scheduleDate} onClick={handleScheduleVisit}>
                <Calendar className="h-4 w-4 mr-1.5" /> Marcar Visita
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
