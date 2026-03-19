import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCard from "./PipelineCard";
import PipelineCardHover from "./PipelineCardHover";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { PIPELINE_STAGE_EMOJIS, PIPELINE_STAGE_COLORS, PIPELINE_STAGE_BG } from "@/lib/celebrations";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatBRLCompact } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import PipelineStageTransitionPopup, { needsTransitionPopup, type TransitionResult } from "./PipelineStageTransitionPopup";

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

const formatVGV = formatBRLCompact;

// Virtualized card list — only renders visible cards + small buffer
const INITIAL_RENDER = 15;
const LOAD_MORE_BATCH = 20;

const VirtualizedCardList = memo(function VirtualizedCardList({
  stageLeads, stage, stages, segmentos, corretorNomes, corretorAvatars, parcerias,
  selectionMode, selectedLeads, arrivedLeadId,
  onToggleSelect, onSelectLead, onMoveLead, onTransferred, stageIndexMap, handleDragStart,
  tarefasMap,
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
          <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-2 border border-border/30">
            <span className="text-muted-foreground/30 text-lg">+</span>
          </div>
          <span className="text-[11px] text-muted-foreground/40 font-medium">Arraste leads aqui</span>
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
                corretorAvatar={lead.corretor_id ? corretorAvatars?.[lead.corretor_id] : undefined}
                gerenteNome={lead.gerente_id ? corretorNomes[lead.gerente_id] : undefined}
                parceiroNome={parcerias[lead.id]}
                onDragStart={() => !selectionMode && handleDragStart(lead.id)}
                onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead)}
                onMoveLead={selectionMode ? undefined : onMoveLead}
                onTransferred={onTransferred}
                stageIndexMap={stageIndexMap}
                proximaTarefa={tarefasMap[lead.id] || null}
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

export default function PipelineBoard({ stages, leads, segmentos, corretorNomes, corretorAvatars, parcerias, onMoveLead, onSelectLead, onTransferred, selectionMode, selectedLeads, onToggleSelect }: PipelineBoardProps) {
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

  // Stage transition popup state
  const [transitionPopup, setTransitionPopup] = useState<{ lead: PipelineLead; targetStage: PipelineStage } | null>(null);

  // Fetch next pending task per lead for all visible leads
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const { data: tarefasMap = {}, refetch: refetchTarefas } = useQuery({
    queryKey: ["pipeline-tarefas-map", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      // Batch fetch in chunks of 200
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
            // Keep only the earliest task per lead
            if (!map[t.pipeline_lead_id]) {
              map[t.pipeline_lead_id] = { tipo: t.tipo || "follow_up", vence_em: t.vence_em, hora_vencimento: t.hora_vencimento };
            }
          }
        }
      }
      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Auto-fix: move leads with negocio_id that are stuck in non-convertido stages
  const autoFixRan = useRef(false);
  useEffect(() => {
    if (autoFixRan.current || !stages.length || !leads.length) return;
    const convertidoStage = stages.find(s => s.tipo === "convertido");
    const descarteStage = stages.find(s => s.tipo === "descarte");
    if (!convertidoStage) return;
    
    const stuckLeads = leads.filter(l => {
      if (!l.negocio_id) return false;
      if (l.stage_id === convertidoStage.id) return false;
      if (descarteStage && l.stage_id === descarteStage.id) return false;
      return true;
    });

    if (stuckLeads.length > 0) {
      autoFixRan.current = true;
      console.log(`[Pipeline] Auto-moving ${stuckLeads.length} leads with negócio to Convertido`);
      Promise.all(
        stuckLeads.map(l => onMoveLead(l.id, convertidoStage.id))
      );
    }
  }, [stages, leads, onMoveLead]);

  // Filter stages: hide "Convertido" from corretores (only visible to gerente/CEO)
  const visibleStages = useMemo(() => {
    if (isGestor || isAdmin) return stages;
    return stages.filter(s => s.tipo !== "convertido");
  }, [stages, isGestor, isAdmin]);

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
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [visibleStages, leads]);

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
    if (needsTransitionPopup(targetStage.nome, targetStage.tipo)) {
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

    if (isDescarte && lead) {
      // ─── Descarte: insert into Oferta Ativa, then DELETE from pipeline ───
      try {
        const empreendimento = extra.empreendimento || lead.empreendimento || "";

        // Auto-match OA list by empreendimento
        let listaId = extra.listaId || null;
        if (!listaId && empreendimento) {
          const { data: listas } = await supabase
            .from("oferta_ativa_listas")
            .select("id, empreendimento")
            .in("status", ["ativa", "liberada"]) as any;
          if (listas?.length) {
            const match = listas.find((l: any) => l.empreendimento?.toLowerCase() === empreendimento.toLowerCase());
            if (match) listaId = match.id;
          }
        }

        // Insert into Oferta Ativa if we found a list
        if (listaId) {
          await supabase.from("oferta_ativa_leads").insert({
            lista_id: listaId,
            nome: lead.nome,
            telefone: lead.telefone || "",
            email: lead.email || "",
            empreendimento,
            status: "na_fila",
            observacoes: result.observacao || null,
            corretor_id: lead.corretor_id || null,
          } as any);
          toast.success("📋 Lead enviado para Oferta Ativa!");
        } else {
          toast.warning("⚠️ Nenhuma lista de Oferta Ativa encontrada para este empreendimento.");
        }

        // Save history record before deleting
        const { data: userData } = await (supabase.auth as any).getUser();
        await supabase.from("pipeline_historico").insert({
          pipeline_lead_id: lead.id,
          stage_anterior_id: lead.stage_id,
          stage_novo_id: result.targetStageId,
          movido_por: userData?.user?.id || null,
          observacao: result.observacao || null,
        });

        // Register activity
        await supabase.from("pipeline_atividades").insert({
          pipeline_lead_id: lead.id,
          tipo: "descarte",
          titulo: `Lead descartado — enviado para Oferta Ativa`,
          descricao: result.observacao || "Descarte sem observação",
          status: "concluida",
          created_by: userData?.user?.id || "00000000-0000-0000-0000-000000000000",
        });

        // DELETE from pipeline_leads
        const { error: deleteError } = await supabase
          .from("pipeline_leads")
          .delete()
          .eq("id", lead.id);

        if (deleteError) {
          console.error("Error deleting lead on descarte:", deleteError);
          toast.error("Erro ao remover lead do pipeline.");
        } else {
          // Remove from local state
          // Trigger reload via onMoveLead won't work since lead is deleted,
          // so we dispatch a custom approach: just filter out locally
          toast.success("🗑️ Lead removido do pipeline.");
        }
      } catch (err) {
        console.error("Error in descarte flow:", err);
        toast.error("Erro no processo de descarte.");
      }

      // Force reload to sync state
      window.dispatchEvent(new CustomEvent("pipeline-reload"));
      return;
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

      {/* Mini-map nav pills */}
      <div className="shrink-0 flex items-center gap-1.5 mb-2 px-0.5 overflow-x-auto scrollbar-none" style={{ paddingTop: 12 }}>
        {visibleStages.map((stage, idx) => {
          const stageLeads = leadsByStage.get(stage.id) || [];
          const isActive = idx === activeIndex;
          const emoji = PIPELINE_STAGE_EMOJIS[stage.nome] || "📍";
          return (
            <button
              key={stage.id}
              onClick={() => scrollToIndex(idx)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap",
                background: isActive ? "#fff" : "transparent",
                border: isActive ? "1px solid #E2E8F0" : "1px solid transparent",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                color: isActive ? "#1E293B" : "#94A3B8",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span style={{ fontSize: 14 }}>{emoji}</span>
              <span>{stage.nome}</span>
              <span style={{ fontWeight: 800, color: isActive ? "#1E293B" : "#94A3B8" }}>
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
            const STAGE_THEMES: Record<string, { emojiBg: string; badgeBg: string; badgeColor: string; gradient: string }> = {
              "Novo Lead": { emojiBg: "#EFF6FF", badgeBg: "#EFF6FF", badgeColor: "#1D4ED8", gradient: "linear-gradient(90deg, #2563EB, #60A5FA)" },
              "Sem Contato": { emojiBg: "#FEF2F2", badgeBg: "#FEF2F2", badgeColor: "#DC2626", gradient: "linear-gradient(90deg, #EF4444, #FCA5A5)" },
              "Contato Iniciado": { emojiBg: "#F0FDF4", badgeBg: "#F0FDF4", badgeColor: "#059669", gradient: "linear-gradient(90deg, #10B981, #34D399)" },
              "Qualificação": { emojiBg: "#FDF4FF", badgeBg: "#FDF4FF", badgeColor: "#7C3AED", gradient: "linear-gradient(90deg, #8B5CF6, #C084FC)" },
              "Possível Visita": { emojiBg: "#FFFBEB", badgeBg: "#FFFBEB", badgeColor: "#B45309", gradient: "linear-gradient(90deg, #F59E0B, #FCD34D)" },
              "Visita Marcada": { emojiBg: "#FFFBEB", badgeBg: "#FFFBEB", badgeColor: "#B45309", gradient: "linear-gradient(90deg, #F59E0B, #FCD34D)" },
              "Visita Realizada": { emojiBg: "#F0FDF4", badgeBg: "#F0FDF4", badgeColor: "#059669", gradient: "linear-gradient(90deg, #10B981, #34D399)" },
              "Descarte": { emojiBg: "#FEF2F2", badgeBg: "#FEF2F2", badgeColor: "#DC2626", gradient: "linear-gradient(90deg, #EF4444, #FCA5A5)" },
              "Convertido": { emojiBg: "#F5F3FF", badgeBg: "#F5F3FF", badgeColor: "#7C3AED", gradient: "linear-gradient(90deg, #8B5CF6, #C084FC)" },
            };
            const theme = STAGE_THEMES[stage.nome] || { emojiBg: "#F1F5F9", badgeBg: "#F1F5F9", badgeColor: "#64748B", gradient: "linear-gradient(90deg, #94A3B8, #CBD5E1)" };
            const emoji = PIPELINE_STAGE_EMOJIS[stage.nome] || "📍";

            // Progress bar percentage (based on count relative to total)
            const maxLeads = Math.max(...[...leadsByStage.values()].map(a => a.length), 1);
            const progressPct = Math.min((stageLeads.length / maxLeads) * 100, 100);

            return (
              <div
                key={stage.id}
                className="flex flex-col shrink-0 h-full"
                style={{
                  width: `${getColumnWidth()}px`,
                  scrollSnapAlign: "start",
                  animation: `pipelineFadeUp 0.35s cubic-bezier(0.25,0.46,0.45,0.94) ${colIdx * 0.05}s both`,
                  transition: isDragOver ? "all 0.2s ease" : undefined,
                }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header card */}
                <div
                  className="shrink-0"
                  style={{
                    background: "#fff",
                    border: isDragOver ? "1px solid #93C5FD" : "1px solid #E2E8F0",
                    borderRadius: 14,
                    padding: "12px 14px",
                    boxShadow: isDragOver ? "0 4px 16px rgba(37,99,235,0.12)" : "0 1px 2px rgba(0,0,0,0.05)",
                    marginBottom: 8,
                    animation: isFlashing ? "columnFlash 0.6s ease-out" : undefined,
                    ["--flash-color" as any]: stage.cor,
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Top: emoji + name + badge */}
                  <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: theme.emojiBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, flexShrink: 0,
                    }}>
                      {emoji}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", flex: 1 }}>
                      {stage.nome}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: theme.badgeColor,
                      background: theme.badgeBg, padding: "2px 9px", borderRadius: 100,
                    }}>
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 3, borderRadius: 100, background: "#F1F5F9",
                    marginBottom: 8, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 100,
                      background: theme.gradient,
                      width: `${progressPct}%`,
                      transition: "width 0.3s ease",
                    }} />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between">
                    {totalVGV > 0 ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: "#1E293B",
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        {formatVGV(totalVGV)}
                      </span>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {avgTime && (
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>
                          ⏱ {avgTime}
                        </span>
                      )}
                      {alerts.semCorretor > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7C3AED" }}>
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
                    if (lead && targetStage && needsTransitionPopup(targetStage.nome, targetStage.tipo)) {
                      setTransitionPopup({ lead, targetStage });
                      return;
                    }
                    completeTransition(leadId, stageId);
                  }}
                  onTransferred={onTransferred}
                  stageIndexMap={stageIndexMap}
                  handleDragStart={handleDragStart}
                  tarefasMap={tarefasMap}
                />
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
    </div>
  );
}
