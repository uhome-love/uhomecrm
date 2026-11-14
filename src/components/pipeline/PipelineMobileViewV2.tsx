import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import type { PipelineStage, PipelineLead, PipelineSegmento } from "@/hooks/usePipeline";
import CardMinimal from "@/components/pipeline-v2/CardPipelineV2";
import MobileTopoV2 from "@/components/pipeline-v2/MobileTopoV2";
import { useSwipeEtapa } from "@/components/pipeline-v2/useSwipeEtapa";
import type { FiltroAcao } from "@/lib/pipelineV2/proximaAcao";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isTaskHigherPriority, type ProximaTarefa } from "@/lib/taskQueryUtils";

interface PipelineMobileViewProps {
  stages: PipelineStage[];
  leads: PipelineLead[];
  segmentos?: PipelineSegmento[]; // legado — não usado pelo CardMinimal
  corretorNomes: Record<string, string>;
  corretorAvatars?: Record<string, string>; // legado — não usado pelo CardMinimal
  parcerias: Record<string, string>;
  onMoveLead?: (leadId: string, newStageId: string, observacao?: string) => void; // legado
  onSelectLead: (lead: PipelineLead) => void;
  onTransferred?: (leadId: string, corretorId: string, corretorNome: string) => void; // legado
  selectionMode?: boolean;
  selectedLeads?: Set<string>;
  onToggleSelect?: (leadId: string) => void;
  clientStatusCounts?: { em_dia: number; desatualizado: number; tarefa_atrasada: number };
  clientStatusFilter?: string;
  onStatusFilterChange?: (f: string) => void;
  acaoCounts?: { atrasada: number; hoje: number; sem: number };
  acaoFilter?: FiltroAcao;
  setAcaoFilter?: (v: FiltroAcao) => void;
}

const LOAD_BATCH = 20;

const HIDDEN_STAGE_TIPOS = new Set([
  "descarte", "caiu", "venda",
  // Etapas comerciais vivem SÓ na aba Negócios (não no kanban de leads):
  "documentacao", "proposta", "contrato_gerado",
  "contato_inicial", "busca", "possibilidade_visita", "visita_marcada",
  "visita_realizada", "convertido", "negociacao",
  "boas_vindas", "envio_oportunidades", "atualizacao_bem_estar", "indicacoes",
]);

const PipelineMobileView = memo(function PipelineMobileView({
  stages: allStages, leads, corretorNomes, parcerias, onMoveLead,
  onSelectLead, selectionMode, selectedLeads, onToggleSelect,
  acaoCounts = { atrasada: 0, hoje: 0, sem: 0 }, acaoFilter = "todos", setAcaoFilter,
}: PipelineMobileViewProps) {
  // Fluxo único: Descarte/Caiu não viram aba (só destino do botão de descarte).
  const stages = useMemo(() => allStages.filter(s => !HIDDEN_STAGE_TIPOS.has(s.tipo)), [allStages]);
  const [activeStageId, setActiveStageId] = useState(stages[0]?.id || "");

  // Keep activeStageId valid
  useEffect(() => {
    if (stages.length > 0 && !stages.find(s => s.id === activeStageId)) {
      setActiveStageId(stages[0].id);
    }
  }, [stages, activeStageId]);

  // Ao trocar de etapa, a lista volta ao primeiro card
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
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

  // Tarefas map (mesma lógica do desktop)
  const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const { data: tarefasMap = {} } = useQuery({
    queryKey: ["pipeline-tarefas-map-mobile", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const map: Record<string, ProximaTarefa & { id?: string; titulo?: string }> = {};
      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        const { data } = await supabase
          .from("pipeline_tarefas")
          .select("id, titulo, pipeline_lead_id, tipo, subtipo, vence_em, hora_vencimento, origem")
          .in("pipeline_lead_id", chunk)
          .eq("status", "pendente")
          .order("vence_em", { ascending: true })
          .order("hora_vencimento", { ascending: true });
        if (data) {
          for (const row of data) {
            const nextTask = { id: row.id, titulo: row.titulo || "Tarefa", tipo: row.tipo, subtipo: (row as any).subtipo ?? null, vence_em: row.vence_em, hora_vencimento: row.hora_vencimento, origem: (row as any).origem ?? null };
            const currentTask = map[row.pipeline_lead_id];
            if (!currentTask || isTaskHigherPriority(nextTask, currentTask)) {
              map[row.pipeline_lead_id] = nextTask;
            }
          }
        }
      }
      return map;
    },
    staleTime: 30_000,
  });

  // Cadência "Sem Contato" (mesma leitura do quadro do computador)
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

  const activeIdx = stages.findIndex(s => s.id === activeStageId);
  const swipe = useSwipeEtapa({
    podeAnterior: activeIdx > 0,
    podeProxima: activeIdx >= 0 && activeIdx < stages.length - 1,
    onAnterior: () => { if (activeIdx > 0) setActiveStageId(stages[activeIdx - 1].id); },
    onProxima: () => { if (activeIdx < stages.length - 1) setActiveStageId(stages[activeIdx + 1].id); },
  });
  const etapasTopo = useMemo(() => stages.map(s => ({ id: s.id, nome: s.tipo === "convertido" ? "Negócio" : s.nome, tipo: s.tipo, qtd: stageCounts[s.id] || 0, cor: s.cor })), [stages, stageCounts]);

  const activeStage = stages.find(s => s.id === activeStageId);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    window.dispatchEvent(new CustomEvent("pipeline-mobile-scroll", { detail: el.scrollTop > 40 }));
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      setVisibleCount(prev => Math.min(prev + LOAD_BATCH, stageLeads.length));
    }
  }, [stageLeads.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{
            flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
            padding: "0 12px max(6rem, calc(env(safe-area-inset-bottom) + 5rem))",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <MobileTopoV2
            contadores={acaoCounts}
            acaoFilter={acaoFilter}
            onAcaoFilter={(v) => setAcaoFilter?.(v)}
            etapas={etapasTopo}
            etapaAtivaId={activeStageId}
            onEtapa={setActiveStageId}
          />
          <div {...swipe.handlers} style={{ ...swipe.style, display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          {stageLeads.length === 0 && (
            <div
              className="text-muted-foreground"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "48px 0",
                fontSize: 13, fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 32, marginBottom: 8 }}>📭</span>
              Nenhum lead nesta etapa
            </div>
          )}
          {visibleLeads.map((lead, idx) => (
            <div
              key={lead.id}
              className="animate-fade-in motion-reduce:animate-none"
              style={{ width: "100%", animationDelay: `${Math.min(idx, 8) * 25}ms` }}
            >
              <CardMinimal
                lead={lead}
                stage={activeStage}
                stages={stages}
                onMoveLead={onMoveLead}
                corretorNome={lead.corretor_id ? corretorNomes[lead.corretor_id] : undefined}
                parceiroNome={parcerias[lead.id]}
                proximaTarefa={tarefasMap[lead.id] || null}
                cadencia={cadenciaMap[lead.id] || null}
                variante="toque"
                onDragStart={() => { /* mobile: sem drag */ }}
                onClick={() => selectionMode ? onToggleSelect?.(lead.id) : onSelectLead(lead)}
              />
            </div>
          ))}
          </div>
        </div>
    </div>
  );
});

export default PipelineMobileView;
