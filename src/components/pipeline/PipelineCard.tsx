import { memo, useState, useMemo } from "react";
import type { PipelineLead, PipelineSegmento, PipelineStage } from "@/hooks/usePipeline";
import { Phone, MessageCircle, Handshake, ArrowRightLeft, FileText, Flame, Snowflake, ThermometerSun } from "lucide-react";
import { getScoreTooltip } from "@/lib/scoreTemperatureLabels";
import { calculateLeadScore } from "@/lib/leadScoring";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PartnershipDialog from "./PartnershipDialog";
import PipelineTransferDialog from "./PipelineTransferDialog";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import WhatsAppTemplatesDialog from "./WhatsAppTemplatesDialog";

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

// Empreendimento color hash
function empColorHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#EA580C"];
  return colors[Math.abs(hash) % colors.length];
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

  // Determine stripe color based on status
  const stripeGradient = useMemo(() => {
    if (status.indicator === "🔴") return "linear-gradient(90deg, #DC2626, #F87171)";
    if (status.indicator === "🟡" || status.indicator === "⚠️") return "linear-gradient(90deg, #D97706, #FCD34D)";
    return "linear-gradient(90deg, #059669, #34D399)";
  }, [status.indicator]);

  // Days in stage for badge
  const daysInStage = useMemo(() => {
    const d = new Date(lead.stage_changed_at);
    if (isNaN(d.getTime())) return 0;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }, [lead.stage_changed_at]);

  const daysBadge = useMemo(() => {
    if (daysInStage <= 2) return { bg: "#ECFDF5", color: "#059669", border: "#A7F3D0" };
    if (daysInStage <= 5) return { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" };
    return { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" };
  }, [daysInStage]);

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

  // Origin tag
  const originTag = useMemo(() => {
    const o = lead.origem?.toLowerCase() || "";
    if (o.includes("oferta")) return { label: "OA", bg: "#F5F3FF", color: "#7C3AED" };
    if (o.includes("portal") || o.includes("zap") || o.includes("olx")) return { label: "PORTAL", bg: "#FFF7ED", color: "#EA580C" };
    if (daysInStage === 0) return { label: "NOVO", bg: "#EFF6FF", color: "#1D4ED8" };
    return null;
  }, [lead.origem, daysInStage]);

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
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        cursor: "grab",
        transition: "all 0.18s cubic-bezier(0.25,0.46,0.45,0.94)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#93C5FD";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,99,235,0.10)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
      className="group select-none active:cursor-grabbing"
    >
      {/* Stripe top 3px */}
      <div style={{ height: 3, background: stripeGradient }} />

      {/* Body */}
      <div style={{ padding: "13px 14px 11px", minHeight: 120 }}>
        {/* ROW 1: Name + tags + days badge */}
        <div className="flex items-center justify-between gap-1.5" style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px",
            color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1,
          }}>
            {cleanName(lead.nome)}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {originTag && (
              <span style={{
                fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
                padding: "3px 7px", borderRadius: 5,
                background: originTag.bg, color: originTag.color,
              }}>
                {originTag.label}
              </span>
            )}
            {tempConfig && (
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold ${tempConfig.bg} ${tempConfig.cls}`}
                title={lead.oportunidade_score != null ? getScoreTooltip(lead.oportunidade_score) : tempConfig.label}
              >
                <tempConfig.icon className="h-2.5 w-2.5" />
              </span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 100,
              background: daysBadge.bg, color: daysBadge.color,
              border: `1px solid ${daysBadge.border}`,
            }}>
              {daysInStage}d
            </span>
          </div>
        </div>

        {/* ROW 2: Corretor */}
        {corretorNome && (
          <div className="flex items-center gap-1.5" style={{ marginBottom: 5 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              boxShadow: "0 0 0 1.5px #fff, 0 1px 2px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff",
              overflow: "hidden",
            }}>
              {corretorAvatar ? (
                <img src={corretorAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                corretorNome[0]
              )}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563EB" }}>
              {corretorNome.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        )}

        {/* ROW 3: Empreendimento + Phone */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          flexWrap: "nowrap", overflow: "hidden", marginBottom: 5,
        }}>
          {displayEmpreendimento && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "#F1F5F9", border: "1px solid #E2E8F0",
              borderRadius: 6, padding: "3px 8px",
              fontSize: 11, fontWeight: 600, color: "#334155",
              flexShrink: 0, maxWidth: 140,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: empColorHash(displayEmpreendimento),
                flexShrink: 0,
              }} />
              {displayEmpreendimento}
            </span>
          )}
          {lead.telefone && (
            <span style={{
              fontSize: 11, color: "#94A3B8",
              fontFamily: "'DM Mono', monospace",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              flexShrink: 1, minWidth: 0,
            }}>
              {formatPhone(lead.telefone)}
            </span>
          )}
        </div>

        {/* Badges row — score inline with partnership/negocio */}
        {(parceiroNome || lead.negocio_id) && (
          <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
            {parceiroNome && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#7C3AED",
                background: "#F5F3FF", padding: "2px 6px", borderRadius: 5,
                display: "inline-flex", alignItems: "center", gap: 3,
              }}>
                <Handshake style={{ height: 10, width: 10 }} /> {parceiroNome.split(" ")[0]}
              </span>
            )}
            {lead.negocio_id && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#059669",
                background: "#ECFDF5", padding: "2px 6px", borderRadius: 5,
              }}>✅ Negócio</span>
            )}
          </div>
        )}

        {/* Campaign tags - non-empreendimento only */}
        {(lead.tags || []).length > 0 && (() => {
          const NON_EMP_TAGS: Record<string, { label: string; color: string; bg: string }> = {
            MELNICK_DAY: { label: "🔥 Melnick Day", color: "#EA580C", bg: "#FFF7ED" },
          };
          const rendered = (lead.tags || []).map(tag => {
            const cfg = NON_EMP_TAGS[tag];
            if (!cfg) return null;
            return (
              <span key={tag} style={{
                fontSize: 9, fontWeight: 700, color: cfg.color, background: cfg.bg,
                padding: "2px 6px", borderRadius: 5,
              }}>
                {cfg.label}
              </span>
            );
          }).filter(Boolean);
          return rendered.length > 0 ? (
            <div className="flex items-center gap-1 flex-wrap" style={{ marginBottom: 4 }}>
              {rendered}
            </div>
          ) : null;
        })()}

        {/* ROW 4: Status */}
        <CardStatusLine status={status} stageChangedAt={lead.stage_changed_at} />
      </div>

      {/* Create Negócio button — only on Visita Realizada without linked deal */}
      {stage?.nome?.toLowerCase().includes("visita realizada") && !lead.negocio_id && !negocioCriado && (
        <div data-actions-area style={{ padding: "0 14px 8px" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={criandoNegocio}
            className="w-full h-7 text-[11px] gap-1.5 font-semibold"
            style={{
              borderColor: "#A7F3D0", color: "#059669",
              borderRadius: 8,
            }}
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
        <div data-actions-area style={{ padding: "0 14px 8px" }}>
          <div style={{
            width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600, color: "#059669", background: "#ECFDF5", borderRadius: 8,
          }}>
            ✅ Negócio criado com sucesso!
          </div>
        </div>
      )}

      {/* Convertido stage — "Voltar para Pipeline" */}
      {stage?.tipo === "convertido" && (
        <div data-actions-area style={{ padding: "0 14px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#94A3B8", textAlign: "center" }}>🎯 Negócio em andamento</div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[11px] gap-1.5 font-semibold"
            style={{ borderColor: "#FDE68A", color: "#D97706", borderRadius: 8 }}
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

      {/* Footer separator */}
      <div style={{ height: 1, background: "#F1F5F9" }} />

      {/* Card Footer — 3 equal buttons */}
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
