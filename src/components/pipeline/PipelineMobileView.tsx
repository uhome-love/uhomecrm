import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import PipelineCard from "./PipelineCard";
import { PIPELINE_STAGE_EMOJIS } from "@/lib/celebrations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

interface PipelineMobileViewProps {
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
  clientStatusCounts: { em_dia: number; desatualizado: number; tarefa_atrasada: number };
  clientStatusFilter: string;
  onStatusFilterChange: (f: string) => void;
}

const LOAD_BATCH = 20;

const PipelineMobileView = memo(function PipelineMobileView({
  stages, leads, segmentos, corretorNomes, corretorAvatars, parcerias,
  onMoveLead, onSelectLead, onTransferred, selectionMode, selectedLeads, onToggleSelect,
  clientStatusCounts, clientStatusFilter, onStatusFilterChange,
}: PipelineMobileViewProps) {
  const { isGestor, isAdmin } = useUserRole();
  const [activeStageId, setActiveStageId] = useState(stages[0]?.id || "");
  const tabsRef = useRef<HTMLDivElement>(null);

  // Keep activeStageId valid
  useEffect(() => {
    if (stages.length > 0 && !stages.find(s => s.id === activeStageId)) {
      setActiveStageId(stages[0].id);
    }
  }, [stages, activeStageId]);

  // Scroll active tab into view
  useEffect(() => {
    const el = tabsRef.current?.querySelector(`[data-stage-id="${activeStageId}"]`) as HTMLElement;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeStageId]);

  // Leads per stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stages) counts[s.id] = 0;
    for (const l of leads) {
      if (counts[l.stage_id] !== undefined) counts[l.stage_id]++;
    }
    return counts;
  }, [stages, leads]);

  // Filter leads for active stage
  const stageLeads = useMemo(
    () => leads.filter(l => l.stage_id === activeStageId),
    [leads, activeStageId]
  );

  // Virtualization
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH);
  useEffect(() => setVisibleCount(LOAD_BATCH), [activeStageId]);
  const visibleLeads = stageLeads.slice(0, visibleCount);
  const hasMore = visibleCount < stageLeads.length;

  // Stage index map for card
  const stageIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    stages.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [stages]);

  // Tarefas map
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const { data: tarefasMap = {} } = useQuery({
    queryKey: ["pipeline-tarefas-map-mobile", leadIdsKey],
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
          for (const row of data) {
            if (!map[row.pipeline_lead_id]) {
              map[row.pipeline_lead_id] = { tipo: row.tipo, vence_em: row.vence_em, hora_vencimento: row.hora_vencimento };
            }
          }
        }
      }
      return map;
    },
    staleTime: 30_000,
  });

  const activeStage = stages.find(s => s.id === activeStageId);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      setVisibleCount(prev => Math.min(prev + LOAD_BATCH, stageLeads.length));
    }
  }, [stageLeads.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Stage Tabs */}
      <div
        ref={tabsRef}
        style={{
          display: "flex",
          background: "#fff",
          borderBottom: "1px solid #F1F5F9",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          padding: "0 16px",
          gap: 4,
          position: "sticky",
          top: 0,
          zIndex: 35,
        }}
        className="scrollbar-none"
      >
        {stages.map(stage => {
          const isActive = stage.id === activeStageId;
          const emoji = PIPELINE_STAGE_EMOJIS[stage.nome] || "📋";
          const count = stageCounts[stage.id] || 0;
          return (
            <button
              key={stage.id}
              data-stage-id={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 14px",
                whiteSpace: "nowrap",
                borderBottom: isActive ? "2px solid #2563EB" : "2px solid transparent",
                fontSize: 13, fontWeight: 600,
                color: isActive ? "#0F172A" : "#64748B",
                cursor: "pointer", flexShrink: 0,
                transition: "all 0.15s",
                background: "transparent", border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: 2,
                borderBottomColor: isActive ? "#2563EB" : "transparent",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span style={{ fontSize: 14 }}>{emoji}</span>
              {stage.nome}
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: "1px 7px", borderRadius: 100,
                background: isActive ? "#EFF6FF" : "#F1F5F9",
                color: isActive ? "#1D4ED8" : "#64748B",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>


      {/* Cards List */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 10,
          padding: "12px 16px 80px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {stageLeads.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "48px 0",
            color: "#94A3B8", fontSize: 13, fontWeight: 500,
          }}>
            <span style={{ fontSize: 32, marginBottom: 8 }}>📭</span>
            Nenhum lead nesta etapa
          </div>
        )}
        {visibleLeads.map(lead => (
          <div key={lead.id} style={{ width: "100%" }}>
            <PipelineCard
              lead={lead}
              stage={activeStage}
              stages={stages}
              segmentos={segmentos}
              corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
              corretorAvatar={lead.corretor_id ? corretorAvatars?.[lead.corretor_id] : undefined}
              parceiroNome={parcerias[lead.id]}
              onDragStart={() => { }}
              onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead)}
              onMoveLead={selectionMode ? undefined : onMoveLead}
              onTransferred={onTransferred}
              stageIndexMap={stageIndexMap}
              proximaTarefa={tarefasMap[lead.id] || null}
            />
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => setVisibleCount(prev => Math.min(prev + LOAD_BATCH, stageLeads.length))}
            style={{
              width: "100%", padding: "10px 0",
              fontSize: 12, fontWeight: 600, color: "#64748B",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            Mostrar mais ({stageLeads.length - visibleCount} restantes)
          </button>
        )}
      </div>
    </div>
  );
});

export default PipelineMobileView;
