import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import CardMinimal from "./CardMinimal";
import NegocioCriadoColumn from "./NegocioCriadoColumn";
import PipelineCardHover from "./PipelineCardHover";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, AlignLeft, Trash2, Loader2 } from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { PIPELINE_STAGE_EMOJIS, PIPELINE_STAGE_COLORS, PIPELINE_STAGE_BG } from "@/lib/celebrations";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatBRLCompact } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import PipelineStageTransitionPopup, { needsTransitionPopup, type TransitionResult } from "./PipelineStageTransitionPopup";
import { sortLeads, type PipelineSortOrder } from "@/lib/pipelineSortOrder";
import { trackPipelineEvent } from "@/lib/pipelineTelemetry";

interface PipelineBoardProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos: PipelineSegmento[];
  corretorNomes: Record<string, string>;
  corretorAvatars?: Record<string, string>;
  parcerias: Record<string, string>;
  onMoveLead: (leadId: string, newStageId: string, observacao?: string) => void;
  onSelectLead: (lead: PipelineLead) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void;
  selectionMode?: boolean;
  selectedLeads?: Set<string>;
  onToggleSelect?: (leadId: string) => void;
  sortOrder?: PipelineSortOrder;
  // Opcional para preservar consumidores legados (ex: PosVendas) que ainda
  // não passam o mapa; nesse caso o Board faz fallback para query local.
  tarefasMap?: Record<string, { tipo: string; vence_em: string | null; hora_vencimento: string | null }>;
}

const COLUMN_WIDTH_DESKTOP = 268;
const COLUMN_WIDTH_MOBILE = 268;
const COLUMN_GAP = 13;

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
    const t = new Date(l.stage_changed_at).getTime();
    if (Number.isNaN(t)) continue;
    const mins = (now - t) / 60000;
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
  const totalHours = leads.reduce((sum, l) => {
    const t = new Date(l.stage_changed_at).getTime();
    return Number.isNaN(t) ? sum : sum + (now - t) / 3600000;
  }, 0);
  const avg = totalHours / leads.length;
  if (avg < 1) return "<1h";
  if (avg < 24) return `${Math.round(avg)}h`;
  return `${Math.round(avg / 24)}d`;
}

// Confetti for Visita Realizada
function spawnConfetti() {
  const colors = ["hsl(var(--warning-500))", "hsl(var(--success-500))", "hsl(var(--primary))", "#FFFFFF"];
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

const formatVGV = formatBRLCompact;

// Virtualized card list — only renders visible cards + small buffer
const INITIAL_RENDER = 15;
const LOAD_MORE_BATCH = 20;

const VirtualizedCardList = memo(function VirtualizedCardList({
  stageLeads, stage, stages, segmentos, corretorNomes, corretorAvatars, parcerias,
  selectionMode, selectedLeads, arrivedLeadId,
  onToggleSelect, onSelectLead, onMoveLead, onTransferred, stageIndexMap, handleDragStart,
  tarefasMap, whatsappUnreadSet, cadenciaMap, negociosMap,
}: {
  stageLeads: PipelineLead[];
  stage: PipelineStage;
  stages: PipelineStage[];
  segmentos: PipelineSegmento[];
  corretorNomes: Record<string, string>;
  corretorAvatars?: Record<string, string>;
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
  tarefasMap: Record<string, { tipo: string; vence_em: string | null; hora_vencimento: string | null }>;
  whatsappUnreadSet: Set<string>;
  cadenciaMap: Record<string, { tentativa: number; proxima_em: string | null }>;
  negociosMap: Record<string, { fase: string; vgv: number; fase_changed_at: string }>;
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
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-2" style={{ background: "hsl(var(--pipeline-empty-icon-bg) / 0.1)", color: "hsl(var(--pipeline-empty-icon-bg))" }}>
            <AlignLeft size={18} strokeWidth={1.5} />
          </div>
          <span className="text-[12px] font-bold tracking-[-0.2px]" style={{ color: "hsl(var(--pipeline-text-primary))" }}>Nenhum lead aqui</span>
          <span className="text-[11px] mt-0.5" style={{ color: "hsl(var(--pipeline-text-muted))" }}>Os leads desta etapa aparecerão aqui</span>
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
              <CardMinimal
                lead={lead}
                stage={stage}
                stages={stages}
                onMoveLead={onMoveLead}
                onTransferred={onTransferred}
                corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                corretorAvatarUrl={lead.corretor_id ? corretorAvatars?.[lead.corretor_id] : undefined}
                parceiroNome={parcerias[lead.id]}
                proximaTarefa={tarefasMap[lead.id] || null}
                cadencia={cadenciaMap[lead.id] || null}
                negocioInfo={negociosMap[lead.id] || null}
                onDragStart={() => !selectionMode && handleDragStart(lead.id)}
                onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead)}
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

export default function PipelineBoard({ stages, leads, segmentos, corretorNomes, corretorAvatars, parcerias, onMoveLead, onSelectLead, onTransferred, selectionMode, selectedLeads, onToggleSelect, sortOrder = "atividade", tarefasMap: providedTarefasMap }: PipelineBoardProps) {
  const { isGestor, isAdmin } = useUserRole();
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

  // Sweep descartados state
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepConfirmOpen, setSweepConfirmOpen] = useState(false);
  const handleSweepDescartados = useCallback(async () => {
    if (isSweeping) return;
    setSweepConfirmOpen(false);
    setIsSweeping(true);
    try {
      const { data, error } = await supabase.functions.invoke("sweep-descartados");
      if (error) throw error;
      toast.success(data?.message || "Sweep concluído!");
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
    } catch (err) {
      console.error("Sweep error:", err);
      toast.error("Erro ao limpar descartados.");
    } finally {
      setIsSweeping(false);
    }
  }, [isSweeping]);

  // Stage transition popup state
  const [transitionPopup, setTransitionPopup] = useState<{ lead: PipelineLead; targetStage: PipelineStage } | null>(null);

  // Fetch next pending task per lead — só roda em fallback (sem prop).
  // Em PipelineKanban, kanbanTarefasMap é passado como prop e evita query duplicada.
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const shouldFetchLocalTarefas = providedTarefasMap === undefined;
  const { data: localTarefasMap = {} } = useQuery({
    queryKey: ["pipeline-tarefas-map", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const map: Record<string, { tipo: string; vence_em: string | null; hora_vencimento: string | null }> = {};
      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        const { data } = await supabase
          .from("pipeline_tarefas")
          .select("pipeline_lead_id, tipo, vence_em, hora_vencimento")
          .in("pipeline_lead_id", chunk)
          .eq("status", "pendente")
          .order("vence_em", { ascending: true })
          .order("hora_vencimento", { ascending: true });
        if (data) {
          for (const t of data) {
            if (!map[t.pipeline_lead_id]) {
              map[t.pipeline_lead_id] = { tipo: t.tipo || "follow_up", vence_em: t.vence_em, hora_vencimento: t.hora_vencimento };
            }
          }
        }
      }
      return map;
    },
    enabled: shouldFetchLocalTarefas && leadIds.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const tarefasMap = providedTarefasMap ?? localTarefasMap;

  // Fetch leads with unread WhatsApp messages — chunks rodam em PARALELO (Fase B).
  const { data: whatsappUnreadIds = [] as string[] } = useQuery({
    queryKey: ["pipeline-whatsapp-unread", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return [] as string[];
      const chunks: string[][] = [];
      for (let i = 0; i < leadIds.length; i += 500) {
        chunks.push(leadIds.slice(i, i + 500));
      }
      const results = await Promise.all(chunks.map(async (chunk) => {
        const { data } = await supabase
          .from("whatsapp_mensagens")
          .select("lead_id, direction")
          .in("lead_id", chunk)
          .order("timestamp", { ascending: false })
          .limit(1000);
        return data || [];
      }));
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const data of results) {
        for (const m of data) {
          if (!m.lead_id || seen.has(m.lead_id)) continue;
          seen.add(m.lead_id);
          if (m.direction === "received") ids.push(m.lead_id);
        }
      }
      return ids;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const whatsappUnreadSet = useMemo(
    () => new Set<string>(Array.isArray(whatsappUnreadIds) ? whatsappUnreadIds : []),
    [whatsappUnreadIds]
  );

  // Cadência "Sem Contato" — mapa leadId -> { tentativa, proxima_em } (RLS limita ao escopo do usuário)
  const { data: cadenciaRows = [] as { pipeline_lead_id: string; tentativa_atual: number; proxima_em: string | null }[] } = useQuery({
    queryKey: ["pipeline-cadencia-sc", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < leadIds.length; i += 500) chunks.push(leadIds.slice(i, i + 500));
      const results = await Promise.all(chunks.map(async (chunk) => {
        const { data } = await supabase
          .from("lead_cadencia_sem_contato")
          .select("pipeline_lead_id, tentativa_atual, proxima_em")
          .in("status", ["ativa", "aguardando_descarte"])
          .in("pipeline_lead_id", chunk);
        return data || [];
      }));
      return results.flat();
    },
    enabled: leadIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const cadenciaMap = useMemo(() => {
    const map: Record<string, { tentativa: number; proxima_em: string | null }> = {};
    for (const r of cadenciaRows) {
      if (r.pipeline_lead_id) map[r.pipeline_lead_id] = { tentativa: r.tentativa_atual, proxima_em: r.proxima_em };
    }
    return map;
  }, [cadenciaRows]);

  // Negócios vinculados — mapa leadId -> { fase, vgv, fase_changed_at } (lente Leads ⇄ Negócios, Fase 2)
  const { data: negociosRows = [] as { pipeline_lead_id: string; fase: string; vgv_estimado: number | null; vgv_final: number | null; fase_changed_at: string }[] } = useQuery({
    queryKey: ["pipeline-negocios-map", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      const chunks: string[][] = [];
      for (let i = 0; i < leadIds.length; i += 500) chunks.push(leadIds.slice(i, i + 500));
      const results = await Promise.all(chunks.map(async (chunk) => {
        const { data } = await supabase
          .from("negocios")
          .select("pipeline_lead_id, fase, vgv_estimado, vgv_final, fase_changed_at")
          .eq("status", "ativo")
          .in("pipeline_lead_id", chunk);
        return data || [];
      }));
      return results.flat();
    },
    enabled: leadIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const negociosMap = useMemo(() => {
    const map: Record<string, { fase: string; vgv: number; fase_changed_at: string }> = {};
    for (const r of negociosRows) {
      if (r.pipeline_lead_id) {
        map[r.pipeline_lead_id] = {
          fase: r.fase,
          vgv: r.vgv_final || r.vgv_estimado || 0,
          fase_changed_at: r.fase_changed_at,
        };
      }
    }
    return map;
  }, [negociosRows]);



  // "Negócio Criado" (convertido) is now visible to ALL users (corretores included)
  const visibleStages = useMemo(() => {
    return stages;
  }, [stages]);

  const leadsByStage = useMemo(() => {
    // Dedup leads by ID before distributing to columns (definitivo)
    const seen = new Set<string>();
    const uniqueLeads = leads.filter((lead) => {
      if (seen.has(lead.id)) return false;
      seen.add(lead.id);
      return true;
    });

    const map = new Map<string, PipelineLead[]>();
    for (const stage of visibleStages) map.set(stage.id, []);
    for (const lead of uniqueLeads) {
      const arr = map.get(lead.stage_id);
      if (arr) arr.push(lead);
    }
    // Ordenação despachada pelo dropdown (default: Activity-Based).
    // Fallback gracioso: se tarefasMap ainda não carregou e order=atividade,
    // todos caem em "sem tarefa" e ficam created_at DESC — mesma UX do legado.
    for (const [stageId, arr] of map) {
      map.set(stageId, sortLeads(arr, sortOrder, tarefasMap));
    }
    return map;
  }, [visibleStages, leads, tarefasMap, sortOrder]);

  const stageIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    visibleStages.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [visibleStages]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    const colW = getColumnWidth();
    const idx = Math.round(el.scrollLeft / (colW + COLUMN_GAP));
    setActiveIndex(Math.min(idx, visibleStages.length - 1));
  }, [visibleStages.length]);

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

  // DnD handlers — HTML5 drag for desktop
  const handleDragStart = (leadId: string) => {
    dragLeadId.current = leadId;
    // Cancel any scroll-drag in progress
    setIsDraggingScroll(false);
    scrollDragActive.current = false;
  };
  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageId) setDragOverStage(stageId);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column, not entering a child
    const related = e.relatedTarget as HTMLElement | null;
    const current = e.currentTarget as HTMLElement;
    if (related && current.contains(related)) return;
    setDragOverStage(null);
  };
  const handleDragEnd = () => {
    // Clean up if drag was cancelled (e.g. ESC key)
    dragLeadId.current = null;
    setDragOverStage(null);
  };
  const completeTransition = useCallback((lid: string, stageId: string, observacao?: string) => {
    const lead = leads.find(l => l.id === lid);
    const targetStage = stages.find(s => s.id === stageId);
    trackPipelineEvent("pipeline_stage_changed", {
      lead_id: lid,
      corretor_id: lead?.corretor_id ?? null,
      from_stage: lead?.stage_id,
      to_stage: stageId,
      to_stage_tipo: targetStage?.tipo,
    });
    onMoveLead(lid, stageId, observacao);

    // Flash animation
    setFlashStage(stageId);
    setTimeout(() => setFlashStage(null), 600);
    setArrivedLeadId(lid);
    setTimeout(() => setArrivedLeadId(null), 500);

    if (targetStage && lead) {
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
          description: `${lead?.nome} está pronto para fechar negócio! +50 XP`,
          duration: 4000,
        });
      }, 300);
    }
  }, [leads, stages, onMoveLead]);

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!dragLeadId.current) return;
    const lid = dragLeadId.current;
    const lead = leads.find(l => l.id === lid);
    if (!lead || lead.stage_id === stageId) { dragLeadId.current = null; return; }
    dragLeadId.current = null;

    const targetStage = stages.find(s => s.id === stageId);
    if (!targetStage) return;

    // Check if this stage needs a transition popup
    if (needsTransitionPopup(targetStage.nome, targetStage.tipo, lead)) {
      setTransitionPopup({ lead, targetStage });
      return;
    }

    completeTransition(lid, stageId);
  };

  const handleTransitionConfirm = useCallback(async (result: TransitionResult) => {
    setTransitionPopup(null);

    const lead = leads.find(l => l.id === result.leadId);
    const extra = result.extraData || {};
    const targetStage = stages.find(s => s.id === result.targetStageId);
    const isDescarte = targetStage?.tipo === "descarte";
    const isCaiu = targetStage?.tipo === "caiu";

    // ─── Negócio caiu: grava motivo, marca negócio perdido e trata o lead ───
    if (isCaiu && lead) {
      try {
        const destino = (extra.destino as QuedaDestino) || "descarte";
        const motivo = String(extra.motivo || result.observacao || "");

        // Resolve o negócio vinculado (state pode estar defasado)
        let negocioId = lead.negocio_id;
        if (!negocioId) {
          const { data } = await supabase
            .from("negocios").select("id").eq("pipeline_lead_id", lead.id).limit(1).maybeSingle();
          negocioId = data?.id || null;
        }

        if (negocioId) {
          await applyNegocioQueda({ negocioId, pipelineLeadId: lead.id, motivo, destino });
          await supabase
            .from("negocios")
            .update({ fase: "perdido", status: "perdido", updated_at: new Date().toISOString() } as any)
            .eq("id", negocioId);
        } else {
          // Sem negócio vinculado — trata só o lead
          const { buildMotivoDescarte } = await import("@/lib/leadOutcome");
          if (destino === "inativar") {
            await supabase.from("pipeline_leads").update({
              motivo_descarte: buildMotivoDescarte("definitivo", motivo || "Sem motivo"),
              tipo_descarte: "definitivo", arquivado: true, negocio_id: null,
            } as any).eq("id", lead.id);
            toast.success("Lead inativado definitivamente");
          } else {
            const descarteStage = stages.find(s => s.tipo === "descarte");
            await supabase.from("pipeline_leads").update({
              motivo_descarte: buildMotivoDescarte("reengajavel", motivo || "Sem motivo"),
              tipo_descarte: "reengajavel", negocio_id: null,
              ...(descarteStage ? { stage_id: descarteStage.id, stage_changed_at: new Date().toISOString() } : {}),
            } as any).eq("id", lead.id);
            toast.info("Lead movido para Descarte (reengajável)");
          }
        }
      } catch (err) {
        console.error("Error in queda flow:", err);
        toast.error("Erro ao registrar a queda do negócio.");
      }
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
      return;
    }


    if (isDescarte && lead) {
      try {
        const motivoTexto = extra.motivo
          ? `Descarte: ${String(extra.motivo).replace(/_/g, " ")}`
          : (result.observacao || "Descarte");

        await supabase
          .from("pipeline_leads")
          .update({
            motivo_descarte: motivoTexto,
            tipo_descarte: "reengajavel",
            arquivado: false,
          } as any)
          .eq("id", lead.id);

        completeTransition(result.leadId, result.targetStageId, result.observacao);
        toast.success("Lead movido para Descarte (reengajável)");
      } catch (err) {
        console.error("Error in descarte flow:", err);
        toast.error("Erro no processo de descarte.");
      }

      window.dispatchEvent(new CustomEvent("pipeline-reload"));
      return;
    }

    // ─── Negócio Criado: gravar VGV + empreendimento ANTES de mover (auto-create usa esses campos) ───
    if (extra.criarNegocio && lead) {
      try {
        const updates: Record<string, any> = {};
        if (extra.vgv && Number(extra.vgv) > 0) updates.valor_estimado = Number(extra.vgv);
        if (extra.empreendimento) updates.empreendimento = extra.empreendimento;
        if (Object.keys(updates).length > 0) {
          await supabase.from("pipeline_leads").update(updates as any).eq("id", lead.id);
        }
      } catch (err) {
        console.error("[handleTransitionConfirm] Erro ao gravar dados de negócio:", err);
      }
    }

    // ─── Normal transition (non-descarte) ───
    completeTransition(result.leadId, result.targetStageId, result.observacao);

    if (!lead) return;

    // Visita Marcada → create visita in agenda
    if (extra.criarVisita && extra.dataVisita) {
      try {
        const userId = (await (supabase.auth as any).getUser()).data?.user?.id;
        const { error: visitaError } = await supabase.from("visitas").insert({
          pipeline_lead_id: result.leadId,
          lead_nome: lead.nome,
          corretor_id: lead.corretor_id || userId,
          empreendimento: extra.empreendimento || lead.empreendimento,
          data_visita: extra.dataVisita,
          hora_visita: extra.horaVisita || null,
          tipo: "presencial",
          origem: "crm",
          status: "marcada",
          observacoes: extra.observacao || null,
        } as any);

        if (visitaError) {
          console.error("Error creating visita:", visitaError);
          toast.error("Erro ao criar visita na agenda");
        } else {
          toast.success("📅 Visita criada na agenda!");
        }

        // Create partnership if parceiro selected
        if (extra.parceiro) {
          const userId = (await (supabase.auth as any).getUser()).data?.user?.id;
          await supabase.from("pipeline_parcerias").insert({
            pipeline_lead_id: result.leadId,
            corretor_principal_id: lead.corretor_id || userId,
            corretor_parceiro_id: extra.parceiro,
            divisao_principal: 50,
            divisao_parceiro: 50,
            motivo: "Visita em parceria",
            criado_por: userId,
          }).then(({ error }) => {
            if (error && error.code !== "23505") console.error("Partnership error:", error);
          });
        }
      } catch (err) {
        console.error("Error creating visita:", err);
      }
    }

    // Visita Realizada → update visita status in agenda + register resultado
    if (extra.registrarVisitaRealizada) {
      const { data: visita } = await supabase
        .from("visitas")
        .select("id")
        .eq("pipeline_lead_id", result.leadId)
        .in("status", ["confirmada", "marcada"])
        .order("data_visita", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (visita) {
        await supabase.from("visitas").update({
          status: "realizada",
          resultado_visita: extra.interesse || null,
          observacoes: extra.feedback || null,
        } as any).eq("id", visita.id);
        toast.success("📋 Visita registrada como realizada na agenda!");
      }
    }

    // Possível Visita → update empreendimento if provided
    if (extra.empreendimento && extra.imovelTipo === "empreendimento") {
      await supabase.from("pipeline_leads").update({
        empreendimento: extra.empreendimento,
      } as any).eq("id", result.leadId);
    }

    // Create task for "faltaParaMarcar"
    if (extra.faltaParaMarcar) {
      await supabase.from("pipeline_tarefas").insert({
        pipeline_lead_id: result.leadId,
        tipo: "follow_up",
        descricao: extra.faltaParaMarcar,
        status: "pendente",
        criado_por: lead?.corretor_id || null,
      } as any);
      toast.info("📋 Tarefa criada: " + extra.faltaParaMarcar.substring(0, 50));
    }
  }, [completeTransition, leads, stages]);

  const handleTransitionCancel = useCallback(() => {
    setTransitionPopup(null);
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
        @keyframes pipelineFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mini-map nav pills — índice de navegação discreto entre etapas */}
      <div className="shrink-0 flex items-center gap-1 mb-2 px-0.5 overflow-x-auto scrollbar-none pb-0.5" style={{ paddingTop: 10 }}>
        {visibleStages.map((stage, idx) => {
          const stageLeads = leadsByStage.get(stage.id) || [];
          const isActive = idx === activeIndex;
          const emoji = PIPELINE_STAGE_EMOJIS[stage.nome] || "📍";
          return (
            <button
              key={stage.id}
              onClick={() => scrollToIndex(idx)}
              title={stage.tipo === "convertido" ? "Negócio Criado" : stage.nome}
              className="transition-all hover:opacity-100"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                whiteSpace: "nowrap",
                background: isActive ? "hsl(var(--primary) / 0.1)" : "transparent",
                border: isActive ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid transparent",
                color: isActive ? "hsl(var(--primary))" : "hsl(var(--pipeline-text-muted))",
                opacity: isActive ? 1 : 0.7,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {emoji && <span style={{ fontSize: 11 }}>{emoji}</span>}
              <span>{stage.tipo === "convertido" ? "Negócio Criado" : stage.nome}</span>
              <span style={{ fontWeight: 700, marginLeft: 1 }}>
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
            className="fixed-arrow absolute left-1 top-[80px] z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollTo("right")}
            className="fixed-arrow absolute right-1 top-[80px] z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 backdrop-blur-sm"
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
          onDragEnd={handleDragEnd}
          className={`flex gap-3 h-full overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none ${isDraggingScroll && scrollDragActive.current ? "cursor-grabbing select-none" : ""}`}
          style={{ scrollSnapType: dragLeadId.current ? "none" : "x proximity" }}
        >
          {visibleStages.map((stage, colIdx) => {
            const stageLeads = leadsByStage.get(stage.id) || [];
            const isDragOver = dragOverStage === stage.id;
            const isFlashing = flashStage === stage.id;
            const totalVGV = stageLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0);
            const alerts = getStageAlerts(stageLeads);
            const avgTime = getAvgTimeLabel(stageLeads);

            // Theme colors per stage
            const makeTheme = (v: string) => ({ emojiBg: `hsl(var(${v}) / 0.1)`, badgeBg: `hsl(var(${v}) / 0.1)`, badgeColor: `hsl(var(${v}))`, gradient: `linear-gradient(90deg, hsl(var(${v})), hsl(var(${v}) / 0.6))` });
            const STAGE_THEMES: Record<string, { emojiBg: string; badgeBg: string; badgeColor: string; gradient: string }> = {
              "Novo Lead": makeTheme("--stage-novo-lead"),
              "Sem Contato": makeTheme("--stage-sem-contato"),
              "Contato Iniciado": makeTheme("--stage-contato"),
              "Busca": makeTheme("--stage-busca"),
              "Aquecimento": makeTheme("--stage-aquecimento"),
              "Visita": makeTheme("--stage-visita"),
              "Pós-Visita": makeTheme("--stage-pos-visita"),
              "Descarte": makeTheme("--stage-descarte"),
              "Negócio Criado": makeTheme("--stage-negocio-criado"),
              // Legacy
              "Qualificação": makeTheme("--stage-busca"),
              "Possível Visita": makeTheme("--stage-aquecimento"),
              "Visita Marcada": makeTheme("--stage-visita"),
              "Visita Realizada": makeTheme("--stage-visita"),
              "Em Evolução": makeTheme("--stage-pos-visita"),
            };
            const theme = STAGE_THEMES[stage.nome] || { emojiBg: "hsl(var(--muted))", badgeBg: "hsl(var(--muted))", badgeColor: "hsl(var(--pipeline-text-muted))", gradient: "linear-gradient(90deg, hsl(var(--pipeline-text-muted)), hsl(var(--pipeline-text-muted) / 0.6))" };
            const emoji = PIPELINE_STAGE_EMOJIS[stage.nome] || "📍";

            // Progress bar percentage (based on count relative to total)
            const maxLeads = Math.max(...[...leadsByStage.values()].map(a => a.length), 1);
            const progressPct = Math.min((stageLeads.length / maxLeads) * 100, 100);

            return (
              <div
                key={stage.id}
                className="flex flex-col shrink-0 h-full"
                data-stage-tipo={stage.tipo || undefined}
                data-drop-target={isDragOver || undefined}
                style={{
                  width: `${getColumnWidth()}px`,
                  scrollSnapAlign: "start",
                  animation: `pipelineFadeUp 0.35s cubic-bezier(0.25,0.46,0.45,0.94) ${colIdx * 0.05}s both`,
                  transition: "all 0.2s ease",
                  background: isDragOver ? "rgba(34,197,94,0.06)" : undefined,
                  borderRadius: isDragOver ? 12 : undefined,
                  outline: isDragOver ? "2px dashed rgba(34,197,94,0.5)" : undefined,
                  outlineOffset: isDragOver ? "2px" : undefined,
                  boxShadow: isDragOver ? "0 8px 24px rgba(34,197,94,0.12)" : undefined,
                }}

                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header card */}
                <div
                  className="shrink-0"
                  style={{
                    background: "hsl(var(--pipeline-column-bg))",
                    border: isDragOver ? "1px solid #22c55e" : "1px solid hsl(var(--pipeline-column-border))",
                    borderRadius: 12,
                    padding: "10px 12px",
                    boxShadow: isDragOver ? "0 4px 16px rgba(34,197,94,0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
                    marginBottom: 8,
                    animation: isFlashing ? "columnFlash 0.6s ease-out" : undefined,
                    ["--flash-color" as any]: "hsl(var(--primary))",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Top: emoji + name + badge */}
                  <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: theme.emojiBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, flexShrink: 0,
                    }}>
                      {emoji}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDragOver ? "#16a34a" : "hsl(var(--pipeline-text-primary))", flex: 1, transition: "color 0.2s ease" }}>
                      {stage.tipo === "convertido" ? "Negócio Criado" : stage.nome}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: isDragOver ? "#16a34a" : "hsl(var(--primary))",
                      background: isDragOver ? "rgba(34,197,94,0.12)" : undefined,
                      borderRadius: isDragOver ? 6 : undefined,
                      padding: isDragOver ? "0 6px" : undefined,
                      transition: "all 0.2s ease",
                    }}>
                      {stageLeads.length}
                    </span>
                    {stage.tipo === "descarte" && stageLeads.length > 0 && (isGestor || isAdmin) && (
                      <button
                        onClick={() => setSweepConfirmOpen(true)}
                        disabled={isSweeping}
                        aria-label="Limpar descartados e enviar para Oferta Ativa"
                        title="Limpar descartados → Oferta Ativa"
                        className="ml-1 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        style={{ fontSize: 11 }}
                      >
                        {isSweeping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Progress bar — unified #4969FF */}
                  <div style={{
                    height: 2, borderRadius: 100, background: "hsl(var(--pipeline-progress-track))",
                    marginBottom: 6, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 100,
                      background: "hsl(var(--primary))",
                      width: `${progressPct}%`,
                      transition: "width 0.3s ease",
                    }} />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between">
                    {totalVGV > 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: "hsl(var(--pipeline-text-muted))",
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {formatVGV(totalVGV)}
                      </span>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {avgTime && (
                        <span style={{ fontSize: 11, color: "hsl(var(--pipeline-text-muted))" }}>
                          ⏱ {avgTime}
                        </span>
                      )}
                      {alerts.semCorretor > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--primary))" }}>
                          👤{alerts.semCorretor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drop placeholder pulsante */}
                {isDragOver && (
                  <div className="h-1 my-1 rounded bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent animate-pulse" />
                )}

                {/* Cards list — convertido usa coluna com agrupamento próprio */}
                {stage.tipo === "convertido" ? (
                  <NegocioCriadoColumn
                    stageLeads={stageLeads}
                    stage={stage}
                    corretorNomes={corretorNomes}
                    parcerias={parcerias}
                    onSelectLead={onSelectLead}
                    handleDragStart={handleDragStart}
                    selectionMode={selectionMode}
                    selectedLeads={selectedLeads}
                    onToggleSelect={onToggleSelect}
                  />
                ) : (
                  <VirtualizedCardList
                    stageLeads={stageLeads}
                    stage={stage}
                    stages={stages}
                    segmentos={segmentos}
                    corretorNomes={corretorNomes}
                    corretorAvatars={corretorAvatars}
                    parcerias={parcerias}
                    selectionMode={selectionMode}
                    selectedLeads={selectedLeads}
                    arrivedLeadId={arrivedLeadId}
                    onToggleSelect={onToggleSelect}
                    onSelectLead={onSelectLead}
                    onMoveLead={(leadId: string, stageId: string) => {
                      const lead = leads.find(l => l.id === leadId);
                      const targetStage = stages.find(s => s.id === stageId);
                      if (lead && targetStage && needsTransitionPopup(targetStage.nome, targetStage.tipo, lead)) {
                        setTransitionPopup({ lead, targetStage });
                        return;
                      }
                      completeTransition(leadId, stageId);
                    }}
                    onTransferred={onTransferred}
                    stageIndexMap={stageIndexMap}
                    handleDragStart={handleDragStart}
                    tarefasMap={tarefasMap}
                    whatsappUnreadSet={whatsappUnreadSet}
                    cadenciaMap={cadenciaMap}
                    negociosMap={negociosMap}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Transition Popup */}
      {transitionPopup && (
        <PipelineStageTransitionPopup
          open={!!transitionPopup}
          onOpenChange={(v) => !v && handleTransitionCancel()}
          lead={transitionPopup.lead}
          targetStage={transitionPopup.targetStage}
          onConfirm={handleTransitionConfirm}
          onCancel={handleTransitionCancel}
        />
      )}

      {/* Confirmação de limpeza dos descartados */}
      <AlertDialog open={sweepConfirmOpen} onOpenChange={setSweepConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar descartados?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso envia apenas os leads já na etapa Descarte para a Oferta Ativa
              e os remove do pipeline visível. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSweepDescartados}>
              Confirmar limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
