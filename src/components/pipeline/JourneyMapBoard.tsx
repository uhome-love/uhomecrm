import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import JourneyMissionCard from "./JourneyMissionCard";
import MissionBriefingDrawer from "./MissionBriefingDrawer";

interface JourneyMapBoardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos: PipelineSegmento[];
  corretorNomes: Record<string, string>;
  parcerias: Record<string, string>;
  onMoveLead: (leadId: string, newStageId: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
}

// Phase theming
interface PhaseTheme {
  name: string;
  icon: string;
  color: string;
  headerBg: string;
  headerBorder: string;
  glow: string;
  missionBadge: string;
  shimmer?: boolean;
  dimmed?: boolean;
}

const PHASE_THEMES: Record<string, PhaseTheme> = {
  novo_lead: {
    name: "Território Inexplorado",
    icon: "🗺️",
    color: "#6B7280",
    headerBg: "rgba(31,41,55,0.8)",
    headerBorder: "rgba(75,85,99,0.6)",
    glow: "none",
    missionBadge: "🗺️ EXPLORAR",
  },
  atendimento: {
    name: "Primeiro Contato",
    icon: "⚡",
    color: "#3B82F6",
    headerBg: "rgba(30,58,138,0.4)",
    headerBorder: "rgba(59,130,246,0.4)",
    glow: "0 0 20px rgba(59,130,246,0.15)",
    missionBadge: "⚡ ENGAJAR",
  },
  qualificacao: {
    name: "Arena de Qualificação",
    icon: "🎯",
    color: "#8B5CF6",
    headerBg: "rgba(76,29,149,0.4)",
    headerBorder: "rgba(139,92,246,0.4)",
    glow: "0 0 20px rgba(139,92,246,0.15)",
    missionBadge: "🎯 QUALIFICAR",
  },
  visita_possivel: {
    name: "Caminho do Troféu",
    icon: "🏃",
    color: "#F59E0B",
    headerBg: "rgba(120,53,15,0.4)",
    headerBorder: "rgba(245,158,11,0.4)",
    glow: "0 0 20px rgba(245,158,11,0.15)",
    missionBadge: "🏃 AVANÇAR",
  },
  visita: {
    name: "Portão da Vitória",
    icon: "🔑",
    color: "#10B981",
    headerBg: "rgba(6,78,59,0.4)",
    headerBorder: "rgba(16,185,129,0.4)",
    glow: "0 0 20px rgba(16,185,129,0.15)",
    missionBadge: "🔑 CONFIRMAR",
  },
  venda: {
    name: "Boss Final",
    icon: "👑",
    color: "#F97316",
    headerBg: "rgba(124,45,18,0.4)",
    headerBorder: "rgba(249,115,22,0.4)",
    glow: "0 0 20px rgba(249,115,22,0.2)",
    missionBadge: "👑 FECHAR",
    shimmer: true,
  },
  descarte: {
    name: "Campo Minado",
    icon: "💀",
    color: "#EF4444",
    headerBg: "rgba(127,29,29,0.2)",
    headerBorder: "rgba(153,27,27,0.3)",
    glow: "none",
    missionBadge: "💀 DESCARTE",
    dimmed: true,
  },
};

function getThemeForStage(stage: PipelineStage): PhaseTheme {
  const tipo = stage.tipo || "";
  if (PHASE_THEMES[tipo]) return PHASE_THEMES[tipo];
  // Fallback by name matching
  const nome = stage.nome.toLowerCase();
  if (nome.includes("novo")) return PHASE_THEMES.novo_lead;
  if (nome.includes("contato")) return PHASE_THEMES.atendimento;
  if (nome.includes("qualific")) return PHASE_THEMES.qualificacao;
  if (nome.includes("possível") || nome.includes("possivel")) return PHASE_THEMES.visita_possivel;
  if (nome.includes("marcada")) return PHASE_THEMES.visita;
  if (nome.includes("realizada") || nome.includes("boss")) return PHASE_THEMES.venda;
  if (nome.includes("descarte") || nome.includes("perdid")) return PHASE_THEMES.descarte;
  return {
    name: stage.nome,
    icon: "📍",
    color: stage.cor,
    headerBg: "rgba(31,41,55,0.6)",
    headerBorder: `${stage.cor}66`,
    glow: "none",
    missionBadge: "📍 MISSÃO",
  };
}

const COLUMN_WIDTH = 300;
const COLUMN_GAP = 12;

const formatVGV = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
};

// Confetti for Boss Final
function spawnConfetti() {
  const colors = ["#F59E0B", "#10B981", "#3B82F6", "#FFFFFF"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden";
  document.body.appendChild(container);
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 6;
    p.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};opacity:0.9;animation:confettiFall ${2 + Math.random()}s ease-in ${delay}s forwards`;
    container.appendChild(p);
  }
  setTimeout(() => container.remove(), 4000);
}

export default function JourneyMapBoard({
  stages, leads, segmentos, corretorNomes, parcerias,
  onMoveLead, onSelectLead, onTransferred,
}: JourneyMapBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [flashStage, setFlashStage] = useState<string | null>(null);
  const [arrivedLeadId, setArrivedLeadId] = useState<string | null>(null);
  const dragLeadId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [briefingLead, setBriefingLead] = useState<PipelineLead | null>(null);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, PipelineLead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of leads) {
      const arr = map.get(lead.stage_id);
      if (arr) arr.push(lead);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }
    return map;
  }, [stages, leads]);

  const stageThemes = useMemo(() => {
    const m = new Map<string, PhaseTheme>();
    stages.forEach(s => m.set(s.id, getThemeForStage(s)));
    return m;
  }, [stages]);

  // Progress stats
  const totalLeads = leads.length;
  const advancedLeads = useMemo(() => {
    const advancedTypes = new Set(["visita", "visita_possivel", "venda"]);
    let count = 0;
    for (const lead of leads) {
      const stage = stages.find(s => s.id === lead.stage_id);
      if (stage && (advancedTypes.has(stage.tipo) || stage.nome.toLowerCase().includes("visita") || stage.nome.toLowerCase().includes("boss"))) {
        count++;
      }
    }
    return count;
  }, [leads, stages]);
  const progressPct = totalLeads > 0 ? Math.round((advancedLeads / totalLeads) * 100) : 0;

  // Scroll state
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollState); ro.disconnect(); };
  }, [updateScrollState]);

  const scrollTo = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -(COLUMN_WIDTH + COLUMN_GAP) : (COLUMN_WIDTH + COLUMN_GAP), behavior: "smooth" });
  };

  // DnD
  const handleDragStart = (leadId: string) => { dragLeadId.current = leadId; };
  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };
  const handleDragLeave = () => setDragOverStage(null);
  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!dragLeadId.current) return;
    const lid = dragLeadId.current;
    const lead = leads.find(l => l.id === lid);
    if (!lead || lead.stage_id === stageId) { dragLeadId.current = null; return; }

    const targetTheme = stageThemes.get(stageId);
    const targetStage = stages.find(s => s.id === stageId);

    onMoveLead(lid, stageId);
    dragLeadId.current = null;

    // Flash animation on target column
    setFlashStage(stageId);
    setTimeout(() => setFlashStage(null), 600);

    // Arrived animation on card
    setArrivedLeadId(lid);
    setTimeout(() => setArrivedLeadId(null), 500);

    // Toast
    if (targetTheme && targetStage) {
      toast(`${targetTheme.icon} ${lead.nome} avançou para ${targetTheme.name}!`, {
        description: "+10 XP",
        duration: 3000,
      });
    }

    // Boss Final special
    if (targetStage?.tipo === "venda" || targetStage?.nome.toLowerCase().includes("realizada")) {
      spawnConfetti();
      setTimeout(() => {
        toast("👑 BOSS ENCONTRADO!", {
          description: `${lead.nome} está pronto para fechar negócio! +50 XP`,
          duration: 4000,
        });
      }, 300);
    }
  };

  // Stage index map for progress dots
  const stageIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    stages.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [stages]);

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden" style={{ background: "#0A0F1E" }}>
      {/* Confetti keyframe injection */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes shimmerBorder {
          0%   { border-color: rgba(249,115,22,0.3); }
          50%  { border-color: rgba(249,115,22,0.9); }
          100% { border-color: rgba(249,115,22,0.3); }
        }
        @keyframes columnFlash {
          0%   { box-shadow: inset 0 0 0 2px var(--flash-color); }
          50%  { box-shadow: inset 0 0 20px 2px var(--flash-color); }
          100% { box-shadow: inset 0 0 0 2px transparent; }
        }
        @keyframes cardArrived {
          0%   { transform: translateY(-20px) scale(0.9); opacity: 0; }
          60%  { transform: translateY(4px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
      `}</style>

      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-widest" style={{
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              🗺️ JORNADA DE VENDAS
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalLeads} leads ativos · {advancedLeads} oportunidades avançadas
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-500">Progresso da jornada</span>
            <span className="text-gray-400 font-bold">{progressPct}% dos leads avançaram</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #10B981, #F59E0B)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Phase distribution bar */}
        <div className="flex h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          {stages.map(stage => {
            const count = (leadsByStage.get(stage.id) || []).length;
            if (count === 0) return null;
            const pct = (count / Math.max(totalLeads, 1)) * 100;
            const theme = stageThemes.get(stage.id)!;
            return (
              <div
                key={stage.id}
                title={`${theme.name}: ${count} leads`}
                className="h-full transition-all duration-500 cursor-pointer hover:opacity-80"
                style={{ width: `${pct}%`, backgroundColor: theme.color, minWidth: count > 0 ? "4px" : 0 }}
              />
            );
          })}
        </div>
      </div>

      {/* Kanban */}
      <div className="relative flex-1 min-h-0">
        {canScrollLeft && (
          <button onClick={() => scrollTo("left")} className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full border transition-all duration-200" style={{ background: "#1C2128", borderColor: "rgba(255,255,255,0.1)" }}>
            <ChevronLeft className="h-5 w-5 text-gray-400" />
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scrollTo("right")} className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full border transition-all duration-200" style={{ background: "#1C2128", borderColor: "rgba(255,255,255,0.1)" }}>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 h-full overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none px-4"
          style={{ scrollSnapType: "x proximity" }}
        >
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) || [];
            const isDragOver = dragOverStage === stage.id;
            const isFlashing = flashStage === stage.id;
            const theme = stageThemes.get(stage.id)!;
            const totalVGV = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);

            return (
              <div
                key={stage.id}
                className="flex flex-col shrink-0 h-full rounded-xl transition-all duration-200"
                style={{
                  width: `${COLUMN_WIDTH}px`,
                  scrollSnapAlign: "start",
                  opacity: theme.dimmed ? 0.7 : 1,
                  animation: isFlashing ? "columnFlash 0.6s ease-out" : undefined,
                  ["--flash-color" as any]: theme.color,
                  background: isDragOver ? `${theme.color}10` : "transparent",
                  boxShadow: isDragOver ? `inset 0 0 0 2px ${theme.color}50` : "none",
                }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header */}
                <div
                  className="shrink-0 px-3.5 py-3 rounded-t-xl border"
                  style={{
                    background: theme.headerBg,
                    borderColor: theme.headerBorder,
                    boxShadow: theme.glow,
                    animation: theme.shimmer ? "shimmerBorder 2s ease-in-out infinite" : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{theme.icon}</span>
                    <span className="text-xs font-bold text-white tracking-tight">{theme.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-[10px] px-1.5 py-0 h-5 font-bold border-0" style={{ background: `${theme.color}30`, color: theme.color }}>
                      {stageLeads.length} missões
                    </Badge>
                    {totalVGV > 0 && (
                      <span className="text-[10px] text-gray-400">{formatVGV(totalVGV)}</span>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                  {stageLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span className="text-2xl mb-2 opacity-30">{theme.icon}</span>
                      <span className="text-[11px] text-gray-600">Nenhuma missão</span>
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <JourneyMissionCard
                      key={lead.id}
                      lead={lead}
                      theme={theme}
                      stages={stages}
                      stageIndexMap={stageIndexMap}
                      corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                      arrived={arrivedLeadId === lead.id}
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => setBriefingLead(lead)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission Briefing Drawer */}
      <MissionBriefingDrawer
        lead={briefingLead}
        stages={stages}
        stageThemes={stageThemes}
        corretorNomes={corretorNomes}
        open={!!briefingLead}
        onOpenChange={(open) => { if (!open) setBriefingLead(null); }}
        onMoveLead={onMoveLead}
        onViewFull={(lead) => { setBriefingLead(null); onSelectLead(lead); }}
      />
    </div>
  );
}
