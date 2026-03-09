import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, Mail, Clock, MessageCircle, Calendar, AlertCircle, Timer, MoreHorizontal, Eye, UserPlus, StickyNote, XCircle, Handshake, ArrowRightLeft, Zap, PhoneCall, MapPin, FileText, Send, CheckCircle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { differenceInHours, differenceInMinutes, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calculateLeadScore, getSlaStatus } from "@/lib/leadScoring";
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

// Mission badges by stage type/name
function cleanName(name: string) {
  if (!name) return "";
  const half = Math.floor(name.length / 2);
  const firstHalf = name.substring(0, half).trim();
  const secondHalf = name.substring(half).trim();
  if (firstHalf === secondHalf) return firstHalf;
  return name;
}

function cleanOrigem(origem: string | null): string {
  if (!origem) return "";
  const lower = origem.toLowerCase();
  if (lower.includes("não informado") || lower.includes("nao informado")) return "Não informada";
  return origem.replace(/_/g, " ");
}

function extractOrigemSource(origem: string | null): string {
  if (!origem) return "";
  const lower = origem.toLowerCase();
  if (lower.includes("tik tok") || lower.includes("tiktok")) return "TikTok";
  if (lower.includes("facebook") || lower.includes("fb")) return "Facebook";
  if (lower.includes("instagram") || lower.includes("ig")) return "Instagram";
  if (lower.includes("google")) return "Google";
  return "";
}

function extractCampanha(origem: string | null): string {
  if (!origem) return "";
  // Extract content in parentheses like "Open Bosque (Video Lucas)" → "Video Lucas"
  const match = origem.match(/\(([^)]+)\)/);
  if (match) return match[1].trim();
  // For format like "Leads Gerado do Tik Tok: Vídeo Open Gabrielle" → extract after ":"
  const colonMatch = origem.match(/:\s*(.+)/);
  if (colonMatch) return colonMatch[1].trim();
  return "";
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

/* ─── Semantic border: blue=recent, amber=warning, red=urgent, green=visita ─── */
function getSemanticBorder(lead: PipelineLead, stageName?: string): string {
  // Visita marcada or realizada → green
  const sn = (stageName || "").toLowerCase();
  if (sn.includes("visita marcada") || sn.includes("visita realizada")) return "border-l-[#22c55e]";
  // Time-based
  const refDate = lead.updated_at || lead.created_at;
  const hours = differenceInHours(new Date(), new Date(refDate));
  if (hours < 3) return "border-l-[#3b82f6]";   // recent → blue
  if (hours < 6) return "border-l-[#f59e0b]";   // warning → amber
  return "border-l-[#ef4444]";                    // urgent → red
}

/* ─── Time badge: <3h gray, 3-6h amber, >6h red, >24h red+pulse ─── */
function getTimeBadge(lead: PipelineLead) {
  const refDate = lead.stage_changed_at || lead.updated_at || lead.created_at;
  const mins = differenceInMinutes(new Date(), new Date(refDate));
  const hours = mins / 60;

  if (hours < 3) {
    // Discrete gray
    const label = mins < 60 ? `${mins}m nesta etapa` : `${Math.floor(hours)}h nesta etapa`;
    return {
      cls: "text-muted-foreground",
      bg: "",
      icon: "clock" as const,
      label,
      pulse: false,
    };
  }
  if (hours < 6) {
    return {
      cls: "text-[#92400e]",
      bg: "bg-[#fef3c7]",
      icon: "warning" as const,
      label: `⏰ ${Math.floor(hours)}h sem contato`,
      pulse: false,
    };
  }
  // >6h → red
  const pulse = hours >= 24;
  const label = hours >= 24
    ? `🚨 ${Math.floor(hours / 24)}d sem contato`
    : `🚨 ${Math.floor(hours)}h sem contato`;
  return {
    cls: "text-[#991b1b]",
    bg: hours >= 24 ? "bg-[#fecaca]" : "bg-[#fee2e2]",
    icon: "alert" as const,
    label,
    pulse,
  };
}

/* ─── Score colors: >70 green, 40-70 amber, <40 red — text only ─── */
function getScoreStyle(score: number) {
  if (score > 70) return "text-[#22c55e] font-bold";
  if (score >= 40) return "text-[#f59e0b] font-bold";
  return "text-[#ef4444] font-bold";
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

  const semanticBorder = getSemanticBorder(lead, stage?.nome);
  const leadScore = calculateLeadScore(lead as any);
  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || "");
  const missionBadge = stage ? getMissionBadge(stage.nome) : getMissionBadge("");
  const daysInStage = differenceInDays(new Date(), new Date(lead.stage_changed_at));
  const currentIdx = stageIndexMap?.get(lead.stage_id) ?? 0;
  const timeBadge = useMemo(() => getTimeBadge(lead), [lead.stage_changed_at, lead.updated_at, lead.created_at]);
  const scoreStyle = getScoreStyle(leadScore.score);

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
    const target = e.target as HTMLElement;
    if (target.closest("[data-actions-area]") || target.closest("[data-no-card-click]")) return;
    if (comunicacaoOpen) return;
    onClick();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", lead.id);
          // Create a semi-transparent drag image
          const el = e.currentTarget;
          if (el) {
            e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
          }
          onDragStart();
        }}
        onDragEnd={(e) => {
          // Ensure cleanup even if drop doesn't fire (e.g. ESC or invalid target)
          e.preventDefault();
        }}
        onClick={handleCardClick}
        className={cn(
          "group relative rounded-lg border-l-[3px] border border-[#e5e7eb] bg-white dark:bg-card cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-150 select-none overflow-hidden",
          semanticBorder
        )}
      >
        {/* Info section — compact */}
        <div className="px-2.5 pt-2 pb-1.5 space-y-0.5">
          {/* Game: Mission badge + days counter */}
          <div className="flex items-center justify-between">
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${missionBadge.color}20`, color: missionBadge.color }}
            >
              {missionBadge.badge}
            </span>
            <span className={`text-[9px] font-bold ${daysLabel.cls}`}>
              {daysLabel.text}
            </span>
          </div>

          {/* Line 1: name + score */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] font-bold text-foreground truncate leading-tight">{cleanName(lead.nome)}</span>
            <span className={cn("text-[9px] px-1 py-0 rounded shrink-0", scoreStyle)}>
              {leadScore.score}
            </span>
          </div>

          {/* Line 2: origem · empreendimento · phone */}
          <div className="text-[10px] text-muted-foreground truncate leading-tight">
            {(() => {
              // Extract source (Facebook, TikTok, etc.)
              const source = extractOrigemSource(lead.origem);
              const origemLabel = source || "";
              
              // Clean empreendimento (deduplicated)
              const empreendimentoClean = displayEmpreendimento || "";
              
              return (
                <>
                  {origemLabel && <span>{origemLabel}</span>}
                  {origemLabel && empreendimentoClean && " · "}
                  {empreendimentoClean ? (
                    <span className="font-medium text-foreground/80">{empreendimentoClean}</span>
                  ) : (
                    <span className="text-amber-500/70 font-medium">🏠 Sem empreend.</span>
                  )}
                </>
              );
            })()}
            {lead.telefone && <span> · {formatPhone(lead.telefone)}</span>}
          </div>

          {/* Line 3: Time badge + corretor */}
          <div className="flex items-center justify-between gap-1">
            <span className={cn(
              "flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0 rounded-full",
              timeBadge.bg,
              timeBadge.cls
            )}>
              {timeBadge.icon === "clock" && <Clock className="h-2.5 w-2.5" />}
              {timeBadge.icon === "warning" && <Timer className="h-2.5 w-2.5" />}
              {timeBadge.icon === "alert" && (
                <AlertCircle className={cn("h-2.5 w-2.5", timeBadge.pulse && "animate-pulse")} />
              )}
              {timeBadge.label}
            </span>

            <div className="flex items-center gap-1">
              {parceiroNome && (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 gap-0.5 h-3.5">
                  <Handshake className="h-2 w-2" /> Parceria
                </Badge>
              )}
              {!corretorNome && isAdmin ? (
                <Badge className="text-[8px] px-1 py-0 h-3.5 bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/30 border font-semibold">
                  📥 CEO
                </Badge>
              ) : !corretorNome ? null : (
                <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">
                  👤 {corretorNome}
                </span>
              )}
            </div>
          </div>

          {/* Journey dots */}
          {stageIndexMap && (
            <div className="flex items-center gap-0.5 pt-0.5">
              {stages.map((s, i) => {
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                return (
                  <div key={s.id} className="flex items-center">
                    <div
                      className="rounded-full"
                      style={{
                        width: isCurrent ? 6 : 4,
                        height: isCurrent ? 6 : 4,
                        backgroundColor: isPast || isCurrent ? missionBadge.color : "hsl(var(--muted))",
                        opacity: isPast ? 0.5 : 1,
                        animation: isCurrent ? "pulseDot 2s ease-in-out infinite" : undefined,
                      }}
                    />
                    {i < stages.length - 1 && (
                      <div className="h-[1.5px]" style={{ width: "6px", backgroundColor: isPast ? `${missionBadge.color}60` : "hsl(var(--muted))" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-px bg-border/50" />

        {/* ─── Actions section — semantic colors ─── */}
        <div data-actions-area className="px-2 py-1.5 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-1">
            {lead.telefone && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2 gap-1 font-semibold bg-[#ede9fe] text-[#5b21b6] hover:bg-[#ddd6fe]"
                onClick={handleCall}
              >
                <Phone className="h-3 w-3 text-[#7c3aed]" /> Ligar
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 font-semibold bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setComunicacaoOpen(true); }}
            >
              <MessageCircle className="h-3 w-3 text-[#22c55e]" /> WhatsApp
            </Button>

            {/* Quick Action dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 gap-1 font-semibold bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Zap className="h-3 w-3" /> Ação
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Registrar ação rápida</div>
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "ligacao", titulo: "Ligação realizada", created_by: user.id });
                    toast.success("📞 Ligação registrada");
                  }}
                >
                  <PhoneCall className="h-3.5 w-3.5 text-[#22c55e]" /> Ligação realizada
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "whatsapp", titulo: "WhatsApp enviado", created_by: user.id });
                    toast.success("💬 WhatsApp registrado");
                  }}
                >
                  <Send className="h-3.5 w-3.5 text-[#22c55e]" /> WhatsApp enviado
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "email", titulo: "E-mail enviado", created_by: user.id });
                    toast.success("✉️ E-mail registrado");
                  }}
                >
                  <Mail className="h-3.5 w-3.5 text-[#3b82f6]" /> E-mail enviado
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "visita", titulo: "Visita realizada", created_by: user.id });
                    toast.success("🏠 Visita registrada");
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 text-[#f59e0b]" /> Visita realizada
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "proposta", titulo: "Proposta enviada", created_by: user.id });
                    toast.success("📄 Proposta registrada");
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-[#8b5cf6]" /> Proposta enviada
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs gap-2"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) return;
                    const obs = prompt("Observação:");
                    if (!obs) return;
                    await supabase.from("pipeline_atividades").insert({ pipeline_lead_id: lead.id, tipo: "nota", titulo: obs, created_by: user.id });
                    toast.success("📝 Observação registrada");
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Adicionar observação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              {!corretorNome && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTransferOpen(true); }} className="text-xs gap-2 font-medium text-[#1e40af]">
                  <UserPlus className="h-3.5 w-3.5" /> Atribuir Corretor
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setScheduleOpen(true); }} className="text-xs gap-2">
                <Calendar className="h-3.5 w-3.5" /> Agendar Visita
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">Mover para:</div>
              {stages.filter(s => s.id !== lead.stage_id).map(s => (
                <DropdownMenuItem key={s.id} onClick={(e) => handleMoveStage(e as any, s.id)} className="text-xs gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                  {s.nome}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPartnerOpen(true); }} className="text-xs gap-2">
                <Handshake className="h-3.5 w-3.5" /> Fazer parceria
              </DropdownMenuItem>
              {corretorNome && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setTransferOpen(true); }} className="text-xs gap-2">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Repassar lead
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onClick} className="text-xs gap-2">
                <Eye className="h-3.5 w-3.5" /> Ver lead completo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAddNote(); }} className="text-xs gap-2">
                <StickyNote className="h-3.5 w-3.5" /> Registrar observação
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkLost(); }} className="text-xs gap-2 text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> Marcar sem interesse (CEO)
                  </DropdownMenuItem>
                </>
              )}
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
        </div>
      </div>
    </TooltipProvider>
  );
});

export default PipelineCard;
