import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCard from "./PipelineCard";
import PipelineCardHover from "./PipelineCardHover";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { PIPELINE_STAGE_EMOJIS } from "@/lib/celebrations";
import { toast } from "sonner";

interface PipelineBoardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos: PipelineSegmento[];
  corretorNomes: Record<string, string>;
  parcerias: Record<string, string>;
  onMoveLead: (leadId: string, newStageId: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
  selectionMode?: boolean;
  selectedLeads?: Set<string>;
  onToggleSelect?: (leadId: string) => void;
}

const COLUMN_WIDTH_DESKTOP = 300;
const COLUMN_WIDTH_MOBILE = 280;
const COLUMN_GAP = 12;

function getColumnWidth() {
  return typeof window !== "undefined" && window.innerWidth < 640 ? COLUMN_WIDTH_MOBILE : COLUMN_WIDTH_DESKTOP;
}

// Memoized stage alert calculation
const stageAlertCache = new WeakMap<PipelineLead[], { warnings: number; dangers: number; total: number; semCorretor: number }>();

function getStageAlerts(leads: PipelineLead[]) {
  const cached = stageAlertCache.get(leads);
  if (cached) return cached;
  let warnings = 0, dangers = 0, semCorretor = 0;
  const now = Date.now();
  for (const l of leads) {
    if (!l.corretor_id) { semCorretor++; continue; }
    const mins = (now - new Date(l.stage_changed_at).getTime()) / 60000;
    if (mins >= 120) dangers++;
    else if (mins >= 30) warnings++;
  }
  const result = { warnings, dangers, total: warnings + dangers, semCorretor };
  stageAlertCache.set(leads, result);
  return result;
}

function getAvgTimeLabel(leads: PipelineLead[]) {
  if (leads.length === 0) return null;
  const now = Date.now();
  const totalHours = leads.reduce((sum, l) =>
    sum + (now - new Date(l.stage_changed_at).getTime()) / 3600000, 0
  );
  const avg = totalHours / leads.length;
  if (avg < 1) return "<1h";
  if (avg < 24) return `${Math.round(avg)}h`;
  return `${Math.round(avg / 24)}d`;
}

// Confetti for Visita Realizada
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

const formatVGV = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
};

// Virtualized card list — only renders visible cards + small buffer
const INITIAL_RENDER = 15;
const LOAD_MORE_BATCH = 20;

const VirtualizedCardList = memo(function VirtualizedCardList({
  stageLeads, stage, stages, segmentos, corretorNomes, parcerias,
  selectionMode, selectedLeads, arrivedLeadId,
  onToggleSelect, onSelectLead, onMoveLead, onTransferred, stageIndexMap, handleDragStart,
}: {
  stageLeads: PipelineLead[];
  stage: PipelineStage;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  corretorNomes: Record<string, string>;
  parcerias: Record<string, string>;
  selectionMode?: boolean;
  selectedLeads?: Set<string>;
  arrivedLeadId: string | null;
  onToggleSelect?: (id: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
  onMoveLead: (leadId: string, stageId: string) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
  stageIndexMap: Map<string, number>;
  handleDragStart: (leadId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset visible count when leads change significantly
  useEffect(() => {
    setVisibleCount(INITIAL_RENDER);
  }, [stageLeads.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Load more when scrolled to within 200px of bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setVisibleCount(prev => Math.min(prev + LOAD_MORE_BATCH, stageLeads.length));
    }
  }, [stageLeads.length]);




  const visibleLeads = stageLeads.slice(0, visibleCount);
  const hasMore = visibleCount < stageLeads.length;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5 scrollbar-thin"
    >
      {stageLeads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
            <span className="text-muted-foreground/40 text-sm">+</span>
          </div>
          <span className="text-[11px] text-muted-foreground/50">Arraste leads aqui</span>
        </div>
      )}
      {visibleLeads.map((lead) => {
        const isSelected = selectionMode && selectedLeads?.has(lead.id);
        return (
          <div
            key={lead.id}
            className={`relative ${selectionMode ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-primary rounded-lg" : ""}`}
            style={{
              animation: arrivedLeadId === lead.id ? "cardArrived 0.4s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
            }}
          >
            {selectionMode && (
              <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-white border-muted-foreground/40"
                }`}>
                  {isSelected && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            )}
            <PipelineCardHover lead={lead} onOpenLead={() => !selectionMode && onSelectLead(lead)}>
              <PipelineCard
                lead={lead}
                stage={stage}
                stages={stages}
                segmentos={segmentos}
                corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                gerenteNome={lead.gerente_id ? corretorNomes[lead.gerente_id] : undefined}
                parceiroNome={parcerias[lead.id]}
                onDragStart={() => !selectionMode && handleDragStart(lead.id)}
                onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead)}
                onMoveLead={selectionMode ? undefined : onMoveLead}
                onTransferred={onTransferred}
                stageIndexMap={stageIndexMap}
              />
            </PipelineCardHover>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setVisibleCount(prev => Math.min(prev + LOAD_MORE_BATCH, stageLeads.length))}
          className="w-full py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Mostrar mais ({stageLeads.length - visibleCount} restantes)
        </button>
      )}
    </div>
  );
});

export default function PipelineBoard({ stages, leads, segmentos, corretorNomes, parcerias, onMoveLead, onSelectLead, onTransferred, selectionMode, selectedLeads, onToggleSelect }: PipelineBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [flashStage, setFlashStage] = useState<string | null>(null);
  const [arrivedLeadId, setArrivedLeadId] = useState<string | null>(null);
  const dragLeadId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const dragScrollStart = useRef({ x: 0, scrollLeft: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const leadsByStage = useMemo(() => {
    // Dedup leads by ID before distributing to columns (definitivo)
    const seen = new Set<string>();
    const uniqueLeads = leads.filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    });

    const map = new Map<string, PipelineLead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of uniqueLeads) {
      const arr = map.get(lead.stage_id);
      if (arr) arr.push(lead);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [stages, leads]);

  const stageIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    stages.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [stages]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    const colW = getColumnWidth();
    const idx = Math.round(el.scrollLeft / (colW + COLUMN_GAP));
    setActiveIndex(Math.min(idx, stages.length - 1));
  }, [stages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  const scrollTo = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const colW = getColumnWidth();
    el.scrollBy({ left: direction === "left" ? -(colW + COLUMN_GAP) : (colW + COLUMN_GAP), behavior: "smooth" });
  };

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * (getColumnWidth() + COLUMN_GAP), behavior: "smooth" });
  };

  // Drag to scroll — only activates on empty areas (not on draggable cards)
  // Uses a distance threshold so short clicks are never hijacked
  const scrollDragActive = useRef(false);
  const handleMouseDown = (e: React.MouseEvent) => {
    // Skip if clicking on a card, button, or any interactive element
    const target = e.target as HTMLElement;
    if (
      target.closest("[draggable]") ||
      target.closest("button") ||
      target.closest("[data-actions-area]") ||
      target.closest("[role='menu']") ||
      target.closest("[data-no-scroll-drag]")
    ) return;
    setIsDraggingScroll(true);
    scrollDragActive.current = false;
    dragScrollStart.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0 };
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollRef.current) return;
    // If a card drag is in progress, stop scroll-drag immediately
    if (dragLeadId.current) { setIsDraggingScroll(false); scrollDragActive.current = false; return; }
    const dx = e.clientX - dragScrollStart.current.x;
    // Only start scrolling after a 8px threshold to avoid blocking card drags
    if (Math.abs(dx) < 8) return;
    scrollDragActive.current = true;
    e.preventDefault();
    scrollRef.current.scrollLeft = dragScrollStart.current.scrollLeft - dx;
  }, [isDraggingScroll]);
  const handleMouseUp = () => { setIsDraggingScroll(false); scrollDragActive.current = false; };

  // DnD handlers
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
    if (targetStage) {
      const emoji = PIPELINE_STAGE_EMOJIS[targetStage.nome] || "📍";
      toast(`${emoji} ${lead.nome} avançou para ${targetStage.nome}!`, {
        description: "+10 XP",
        duration: 3000,
      });
    }

    // Visita Realizada special effect
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

  return (
    <div className="relative flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      {/* Animation keyframes */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
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

      {/* Mini-map nav pills — compact */}
      <div className="shrink-0 flex items-center gap-0.5 mb-1 px-0.5 overflow-x-auto scrollbar-none">
        {stages.map((stage, idx) => {
          const stageLeads = leadsByStage.get(stage.id) || [];
          const isActive = idx === activeIndex;
          return (
            <button
              key={stage.id}
              onClick={() => scrollToIndex(idx)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border/40 hover:border-primary/30"
              }`}
            >
              <span>{stage.nome}</span>
              <span className={`font-bold ${isActive ? "text-primary-foreground" : ""}`}>
                {stageLeads.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban scroll area */}
      <div className="relative flex-1 min-h-0">
        {canScrollLeft && (
          <button
            onClick={() => scrollTo("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollTo("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 backdrop-blur-sm"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex gap-3 h-full overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none ${isDraggingScroll ? "cursor-grabbing select-none" : ""}`}
          style={{ scrollSnapType: "x proximity" }}
        >
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) || [];
            const isDragOver = dragOverStage === stage.id;
            const isFlashing = flashStage === stage.id;
            const totalVGV = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);
            const alerts = getStageAlerts(stageLeads);
            const avgTime = getAvgTimeLabel(stageLeads);

            return (
              <div
                key={stage.id}
                className={`flex flex-col shrink-0 h-full rounded-xl transition-all duration-200 ${
                  isDragOver
                    ? "ring-2 ring-primary/50 bg-primary/5 shadow-xl shadow-primary/10 scale-[1.01]"
                    : "bg-muted/20"
                }`}
                style={{
                  width: `${getColumnWidth()}px`,
                  scrollSnapAlign: "start",
                  animation: isFlashing ? "columnFlash 0.6s ease-out" : undefined,
                  ["--flash-color" as any]: stage.cor,
                }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header — compact */}
                <div className="shrink-0 px-2.5 py-2 bg-card border border-border/40 rounded-t-xl">
                  <div className="flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-2.5 w-1 rounded-full shrink-0" style={{ backgroundColor: stage.cor }} />
                      <span className="text-[11px] font-bold text-foreground truncate">{stage.nome}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{stageLeads.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {totalVGV > 0 && (
                        <span className="text-[9px] font-semibold text-foreground">
                          {formatVGV(totalVGV)}
                        </span>
                      )}
                      {avgTime && (
                        <span className="text-[9px] text-muted-foreground">
                          {avgTime}
                        </span>
                      )}
                      {alerts.semCorretor > 0 && (
                        <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                          👤{alerts.semCorretor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cards list — virtualized */}
                <VirtualizedCardList
                  stageLeads={stageLeads}
                  stage={stage}
                  stages={stages}
                  segmentos={segmentos}
                  corretorNomes={corretorNomes}
                  parcerias={parcerias}
                  selectionMode={selectionMode}
                  selectedLeads={selectedLeads}
                  arrivedLeadId={arrivedLeadId}
                  onToggleSelect={onToggleSelect}
                  onSelectLead={onSelectLead}
                  onMoveLead={onMoveLead}
                  onTransferred={onTransferred}
                  stageIndexMap={stageIndexMap}
                  handleDragStart={handleDragStart}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
