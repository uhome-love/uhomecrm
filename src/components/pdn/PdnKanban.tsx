import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { type PdnEntry, type PdnSituacao } from "@/hooks/usePdn";
import PdnCard from "./PdnCard";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { differenceInDays } from "date-fns";
import { calcProbabilidade, calcRisco } from "@/lib/pdnScoring";

interface Props {
  entries: PdnEntry[];
  readOnly?: boolean;
  onUpdate: (id: string, updates: Record<string, any>) => void;
  searchTerm: string;
  filterCorretor: string;
}

const COLUMNS: { key: PdnSituacao; label: string; emoji: string; color: string; headerBg: string; dotColor: string }[] = [
  { key: "visita", label: "Negócios", emoji: "📋", color: "hsl(var(--primary))", headerBg: "bg-primary/5", dotColor: "bg-primary" },
  { key: "gerado", label: "Gerados", emoji: "📄", color: "#f59e0b", headerBg: "bg-amber-500/5", dotColor: "bg-amber-500" },
  { key: "assinado", label: "Assinados", emoji: "✅", color: "#10b981", headerBg: "bg-emerald-500/5", dotColor: "bg-emerald-500" },
  { key: "caiu", label: "Caiu", emoji: "❌", color: "#ef4444", headerBg: "bg-red-500/5", dotColor: "bg-red-500" },
];

function formatVGV(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

// Sort entries: risco > probabilidade (desc) > VGV (desc)
function sortEntries(items: PdnEntry[]): PdnEntry[] {
  const now = new Date();
  return [...items].sort((a, b) => {
    const riscoA = calcRisco(a).nivel;
    const riscoB = calcRisco(b).nivel;
    const riscoOrder = { risco: 0, atencao: 1, seguro: 2 };
    const riskDiff = (riscoOrder[riscoA] ?? 2) - (riscoOrder[riscoB] ?? 2);
    if (riskDiff !== 0) return riskDiff;

    const probA = calcProbabilidade(a);
    const probB = calcProbabilidade(b);
    if (probA !== probB) return probB - probA;

    return (b.vgv || 0) - (a.vgv || 0);
  });
}

export default function PdnKanban({ entries, readOnly, onUpdate, searchTerm, filterCorretor }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PdnSituacao | null>(null);
  const dragRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter once
  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return entries.filter(e => {
      if (search && !e.nome.toLowerCase().includes(search)) return false;
      if (filterCorretor && e.corretor !== filterCorretor) return false;
      return true;
    });
  }, [entries, searchTerm, filterCorretor]);

  // Group + compute stats + sort in one pass
  const grouped = useMemo(() => {
    const now = new Date();
    const buckets: Record<PdnSituacao, PdnEntry[]> = { visita: [], gerado: [], assinado: [], caiu: [] };
    for (const e of filtered) {
      buckets[e.situacao]?.push(e);
    }
    return COLUMNS.map(col => {
      const rawItems = buckets[col.key] || [];
      const items = col.key === "caiu" || col.key === "assinado" ? rawItems : sortEntries(rawItems);
      let totalVgv = 0;
      let alertCount = 0;
      let hasParados = false;
      for (const e of items) {
        totalVgv += e.vgv || 0;
        if (col.key !== "caiu" && col.key !== "assinado") {
          const days = differenceInDays(now, new Date(e.updated_at));
          if (days >= 5) { alertCount++; hasParados = true; }
          else if (!e.proxima_acao || !e.proxima_acao.trim()) alertCount++;
        }
      }
      return { ...col, items, totalVgv, alertCount, hasParados };
    });
  }, [filtered]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Detect active column on mobile scroll
    const colCount = COLUMNS.length;
    const colW = el.scrollWidth / colCount;
    const idx = Math.round(el.scrollLeft / colW);
    setActiveIndex(Math.min(idx, colCount - 1));
  }, []);

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

  const scrollToIndex = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const colW = el.scrollWidth / COLUMNS.length;
    el.scrollTo({ left: idx * colW, behavior: "smooth" });
  }, []);

  // Stable DnD handlers
  const handleDragStart = useCallback((id: string) => {
    dragRef.current = id;
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, col: PdnSituacao) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  }, [readOnly]);

  const handleDrop = useCallback((e: React.DragEvent, targetSituacao: PdnSituacao) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggedId(null);
    const id = dragRef.current;
    if (!id || readOnly) return;
    const entry = entries.find(en => en.id === id);
    if (!entry || entry.situacao === targetSituacao) return;
    onUpdate(id, { situacao: targetSituacao, ...(targetSituacao !== "caiu" ? { motivo_queda: null } : {}) });
    dragRef.current = null;
  }, [readOnly, entries, onUpdate]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverCol(null);
    dragRef.current = null;
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
        {/* Nav pills — mobile only */}
        <div className="shrink-0 flex items-center gap-1 mb-2 px-1 overflow-x-auto scrollbar-none sm:hidden">
          {grouped.map((col, idx) => (
            <button
              key={col.key}
              onClick={() => scrollToIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 border ${
                idx === activeIndex
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${col.dotColor}`} />
              <span>{col.emoji} {col.label}</span>
              <Badge variant="secondary" className={`text-[9px] px-1 py-0 h-3.5 font-bold ${idx === activeIndex ? "bg-white/20 text-primary-foreground" : ""}`}>
                {col.items.length}
              </Badge>
            </button>
          ))}
        </div>

        {/* Kanban board — flex columns on desktop, snap scroll on mobile */}
        <div
          ref={scrollRef}
          className="flex gap-3 flex-1 min-h-0 overflow-x-auto sm:overflow-x-hidden overflow-y-hidden scroll-smooth scrollbar-none"
          style={{ scrollSnapType: "x mandatory", minHeight: "500px" }}
        >
          {grouped.map((col) => {
            const isDragOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                className={`flex flex-col h-full rounded-xl transition-all duration-200
                  shrink-0 w-[85vw] sm:shrink sm:w-0 sm:flex-1 sm:min-w-[220px]
                  ${isDragOver
                    ? "ring-2 ring-primary/50 bg-primary/5 shadow-xl shadow-primary/10 scale-[1.01]"
                    : "bg-muted/20"
                  }`}
                style={{ scrollSnapAlign: "start" }}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                {/* Column header */}
                <div className={`shrink-0 px-3.5 py-3 bg-card border border-border/40 rounded-t-xl ${col.headerBg}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-3 w-1 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-bold text-foreground tracking-tight">
                      {col.emoji} {col.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-bold ml-auto">
                      {col.items.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {col.totalVgv > 0 && (
                      <span className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5 text-primary" />
                        {formatVGV(col.totalVgv)}
                      </span>
                    )}
                    {col.alertCount > 0 && (
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
                        col.hasParados ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                      }`}>
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {col.alertCount} alerta{col.alertCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                  {col.items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
                        <span className="text-muted-foreground/40 text-sm">+</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">
                        {readOnly ? "Nenhum registro" : "Arraste cards aqui"}
                      </span>
                    </div>
                  )}
                  {col.items.map((entry) => (
                    <PdnCard
                      key={entry.id}
                      entry={entry}
                      readOnly={readOnly}
                      onUpdate={onUpdate}
                      onDragStart={() => handleDragStart(entry.id)}
                      onDragEnd={handleDragEnd}
                      isDragged={draggedId === entry.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
