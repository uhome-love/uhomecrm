import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, MessageCircle, Handshake, ArrowRightLeft, FileText, Flame, Snowflake, ThermometerSun } from "lucide-react";
import { getScoreTooltip } from "@/lib/scoreTemperatureLabels";
import { calculateLeadScore } from "@/lib/leadScoring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PartnershipDialog from "./PartnershipDialog";
import PipelineTransferDialog from "./PipelineTransferDialog";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";
import { cn } from "@/lib/utils";

// Extracted sub-components
import CardStatusLine, { getCardStatus } from "./CardStatusLine";
import CardActionBar from "./CardActionBar";
import CardScheduleVisitDialog from "./CardScheduleVisitDialog";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55"))
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function deduplicateEmpreendimento(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(/[·,;|]/).map(s => s.trim()).filter(Boolean);
  const normalize = (s: string) => s.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
  const seen = new Map<string, string>();
  for (const part of parts) {
    const key = normalize(part);
    if (!seen.has(key)) seen.set(key, part.replace(/\s*\(.*?\)\s*/g, "").trim());
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
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);
  const [whatsappTemplatesOpen, setWhatsappTemplatesOpen] = useState(false);
  const [criandoNegocio, setCriandoNegocio] = useState(false);
  const [negocioCriado, setNegocioCriado] = useState(false);

  const displayEmpreendimento = deduplicateEmpreendimento(lead.empreendimento || (lead as any).origem_detalhe || "");
  const status = useMemo(() => getCardStatus(lead, proximaTarefa || null), [(lead as any).ultima_acao_at, lead.stage_changed_at, proximaTarefa?.tipo, proximaTarefa?.vence_em, proximaTarefa?.hora_vencimento]);

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
        pipeline_lead_id: lead.id, tipo: "ligacao", titulo: "Ligação realizada", created_by: user.id,
      }).then(() => {});
      supabase.from("pipeline_leads").update({
        ultima_acao_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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

  const handleCreateNegocio = async (e: React.MouseEvent) => {
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
        const convertidoStage = stages.find(s => s.tipo === "convertido");
        if (convertidoStage && onMoveLead) onMoveLead(lead.id, convertidoStage.id);
      }
    } catch (err: any) {
      console.error("Erro ao criar negócio:", err);
      toast.error("Erro ao criar negócio: " + (err?.message || "Erro desconhecido"));
    } finally {
      setCriandoNegocio(false);
    }
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
            {tempConfig && (
              <span
                className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold", tempConfig.bg, tempConfig.cls)}
                title={lead.oportunidade_score != null ? getScoreTooltip(lead.oportunidade_score) : `${tempConfig.label}`}
              >
                <tempConfig.icon className="h-2.5 w-2.5" />
              </span>
            )}
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

        {/* Line 2: Corretor + Empreendimento · Phone · Origin */}
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

        {/* Negócio badge */}
        {lead.negocio_id && (
          <div className="flex items-center gap-1 pt-0.5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">✅ Negócio criado</span>
          </div>
        )}

        {/* Campaign tags */}
        {(lead.tags || []).length > 0 && (
          <div className="flex items-center gap-1 pt-0.5 flex-wrap">
            {(lead.tags || []).map(tag => {
              const TAG_CONFIG: Record<string, { label: string; color: string }> = {
                MELNICK_DAY: { label: "🔥 Melnick Day", color: "text-orange-600 dark:text-orange-400 bg-orange-500/10" },
                OPEN_BOSQUE: { label: "🌳 Open Bosque", color: "text-green-600 dark:text-green-400 bg-green-500/10" },
                CASA_TUA: { label: "🏠 Casa Tua", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                LAKE_EYRE: { label: "💎 Lake Eyre", color: "text-purple-600 dark:text-purple-400 bg-purple-500/10" },
                LAS_CASAS: { label: "🏡 Las Casas", color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
                ORYGEM: { label: "✨ Orygem", color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" },
                HIGH_GARDEN_IGUATEMI: { label: "🌿 High Garden", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
                SEEN_TRES_FIGUEIRAS: { label: "👁 Seen Três Figueiras", color: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
                ALTO_LINDOIA: { label: "🏔 Alto Lindóia", color: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
                SHIFT: { label: "⚡ Shift", color: "text-slate-600 dark:text-slate-400 bg-slate-500/10" },
                CASA_BASTIAN: { label: "🏰 Casa Bastian", color: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
                DUETTO: { label: "🎵 Duetto", color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" },
                TERRACE: { label: "🌅 Terrace", color: "text-teal-600 dark:text-teal-400 bg-teal-500/10" },
              };
              const cfg = TAG_CONFIG[tag];
              if (!cfg) return null;
              return (
                <span key={tag} className={`text-[10px] font-bold ${cfg.color} px-1.5 py-0.5 rounded-md`}>
                  {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Line 3: Status line (extracted) */}
        <CardStatusLine status={status} stageChangedAt={lead.stage_changed_at} />
      </div>

      {/* Create Negócio button — only on Visita Realizada without linked deal */}
      {stage?.nome?.toLowerCase().includes("visita realizada") && !lead.negocio_id && !negocioCriado && (
        <div data-actions-area className="px-3 pb-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={criandoNegocio}
            className="w-full h-7 text-[11px] gap-1.5 font-semibold border-green-500/40 text-green-600 dark:text-green-400 hover:bg-green-500/10"
            onClick={handleCreateNegocio}
          >
            {criandoNegocio ? (
              <><span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Criando...</>
            ) : (
              <><FileText className="h-3 w-3" /> Criar Negócio</>
            )}
          </Button>
        </div>
      )}

      {negocioCriado && (
        <div data-actions-area className="px-3 pb-1.5">
          <div className="w-full h-7 flex items-center justify-center text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-500/10 rounded-md">
            ✅ Negócio criado com sucesso!
          </div>
        </div>
      )}

      {/* Convertido stage — "Voltar para Pipeline" */}
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
              const qualStage = stages.find(s => s.nome.toLowerCase().includes("qualifica"));
              if (qualStage) {
                onMoveLead(lead.id, qualStage.id);
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

      {/* Line 4: Action bar (extracted) */}
      <CardActionBar
        leadId={lead.id}
        leadNome={lead.nome}
        leadTelefone={lead.telefone}
        stageId={lead.stage_id}
        stages={stages}
        canTransfer={isAdmin || isGestor || lead.corretor_id === user?.id}
        onWhatsApp={handleWhatsApp}
        onOpenDetail={onClick}
        onScheduleVisit={() => setScheduleOpen(true)}
        onOpenComunicacao={() => setComunicacaoOpen(true)}
        onOpenTransfer={() => setTransferOpen(true)}
        onOpenPartner={() => setPartnerOpen(true)}
        onMarkLost={handleMarkLost}
        onMoveStage={handleMoveStage}
      />

      {/* Dialogs */}
      <div data-no-card-click onClick={(e) => e.stopPropagation()}>
        <CardScheduleVisitDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          lead={lead}
          stages={stages}
          onMoveLead={onMoveLead}
        />
        {partnerOpen && (
          <PartnershipDialog open={partnerOpen} onOpenChange={setPartnerOpen} leadId={lead.id} leadNome={lead.nome} corretorPrincipalId={lead.corretor_id} />
        )}
        {transferOpen && (
          <PipelineTransferDialog open={transferOpen} onOpenChange={setTransferOpen} leadId={lead.id} leadNome={lead.nome} currentCorretorId={lead.corretor_id} stages={stages} onTransferred={(corretorId, nome) => onTransferred?.(lead.id, corretorId, nome)} />
        )}
        {comunicacaoOpen && (
          <CentralComunicacao open={comunicacaoOpen} onOpenChange={setComunicacaoOpen} leadId={lead.id} leadNome={lead.nome} leadTelefone={lead.telefone} leadEmpreendimento={lead.empreendimento} />
        )}
        <WhatsAppTemplatesDialog open={whatsappTemplatesOpen} onOpenChange={setWhatsappTemplatesOpen} leadNome={lead.nome} leadTelefone={lead.telefone} leadEmpreendimento={lead.empreendimento} leadId={lead.id} corretorNome={corretorNome} />
      </div>
    </div>
  );
});

export default PipelineCard;
