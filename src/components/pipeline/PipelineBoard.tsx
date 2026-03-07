import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCard from "./PipelineCard";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { differenceInHours } from "date-fns";

interface PipelineBoardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos: PipelineSegmento[];
  onMoveLead: (leadId: string, newStageId: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
}

const COLUMN_WIDTH = 300;
const COLUMN_GAP = 12;

function getStageAlerts(leads: PipelineLead[]) {
  let alerts = 0;
  for (const l of leads) {
    if (differenceInHours(new Date(), new Date(l.stage_changed_at)) >= 2) alerts++;
  }
  return alerts;
}

function getAvgTimeLabel(leads: PipelineLead[]) {
  if (leads.length === 0) return null;
  const totalHours = leads.reduce((sum, l) =>
    sum + differenceInHours(new Date(), new Date(l.stage_changed_at)), 0
  );
  const avg = totalHours / leads.length;
  if (avg < 1) return "<1h";
  if (avg < 24) return `${Math.round(avg)}h`;
  return `${Math.round(avg / 24)}d`;
}

export default function PipelineBoard({ stages, leads, segmentos, onMoveLead, onSelectLead }: PipelineBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const dragLeadId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const dragScrollStart = useRef({ x: 0, scrollLeft: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, PipelineLead[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const lead of leads) {
      const arr = map.get(lead.stage_id);
      if (arr) arr.push(lead);
    }
    return map;
  }, [stages, leads]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    const idx = Math.round(el.scrollLeft / (COLUMN_WIDTH + COLUMN_GAP));
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
    el.scrollBy({ left: direction === "left" ? -(COLUMN_WIDTH + COLUMN_GAP) : (COLUMN_WIDTH + COLUMN_GAP), behavior: "smooth" });
  };

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * (COLUMN_WIDTH + COLUMN_GAP), behavior: "smooth" });
  };

  // Drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[draggable]")) return;
    setIsDraggingScroll(true);
    dragScrollStart.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0 };
  };
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft = dragScrollStart.current.scrollLeft - (e.clientX - dragScrollStart.current.x);
  }, [isDraggingScroll]);
  const handleMouseUp = () => setIsDraggingScroll(false);

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
    if (dragLeadId.current) {
      onMoveLead(dragLeadId.current, stageId);
      dragLeadId.current = null;
    }
  };

  const formatVGV = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
    return `R$ ${value.toLocaleString("pt-BR")}`;
  };

  return (
    <div className="relative flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      {/* Mini-map nav pills — fixed top */}
      <div className="shrink-0 flex items-center gap-1 mb-2 px-1 overflow-x-auto scrollbar-none">
        {stages.map((stage, idx) => {
          const stageLeads = leadsByStage.get(stage.id) || [];
          const isActive = idx === activeIndex;
          return (
            <button
              key={stage.id}
              onClick={() => scrollToIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: isActive ? "white" : stage.cor }} />
              <span className="hidden sm:inline">{stage.nome}</span>
              <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-3.5 font-bold ${isActive ? "bg-white/20 text-primary-foreground" : ""}`}>
                {stageLeads.length}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Kanban scroll area — fills remaining height */}
      <div className="relative flex-1 min-h-0">
        {/* Navigation arrows */}
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

        {/* Scrollable container — full height, hidden scrollbar */}
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
            const totalVGV = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);
            const alerts = getStageAlerts(stageLeads);
            const avgTime = getAvgTimeLabel(stageLeads);

            return (
              <div
                key={stage.id}
                className={`flex flex-col shrink-0 rounded-xl transition-all duration-200 ${
                  isDragOver
                    ? "ring-2 ring-primary/50 bg-primary/5 shadow-xl shadow-primary/10 scale-[1.01]"
                    : "bg-muted/20"
                }`}
                style={{ width: `${COLUMN_WIDTH}px`, scrollSnapAlign: "start" }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header */}
                <div className="shrink-0 px-3.5 py-3 bg-card border border-border/40 rounded-t-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-1 rounded-full" style={{ backgroundColor: stage.cor }} />
                    <span className="text-xs font-bold text-foreground tracking-tight">{stage.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-bold gap-1">
                      {stageLeads.length} <span className="font-normal text-muted-foreground">leads</span>
                    </Badge>
                    {totalVGV > 0 && (
                      <span className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5 text-primary" />
                        {formatVGV(totalVGV)}
                      </span>
                    )}
                    {avgTime && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {avgTime} média
                      </span>
                    )}
                    {alerts > 0 && (
                      <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {alerts}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards — scrollable vertically within column */}
                <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 overflow-y-auto scrollbar-thin">
                  {stageLeads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
                        <span className="text-muted-foreground/40 text-sm">+</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">Arraste leads aqui</span>
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <PipelineCard
                      key={lead.id}
                      lead={lead}
                      segmentos={segmentos}
                      onDragStart={() => handleDragStart(lead.id)}
                      onClick={() => onSelectLead(lead)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
