import React, { useState, useMemo, useCallback, lazy, Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState, ErrorState } from "@/components/ui/screen-states";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import { loadSortOrder, type SortOrder } from "@/components/pipeline/PipelineSortDropdown";
import PipelineMobileView from "@/components/pipeline/PipelineMobileView";
import { useIsMobile } from "@/hooks/use-mobile";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import StaleDataBadge from "@/components/pipeline/StaleDataBadge";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { todayBRT } from "@/lib/utils";
import { useParceriasMap, usePartnerLeadsByCorretor } from "@/hooks/useParcerias";

const PipelineFlowDashboard = lazy(() => import("@/components/pipeline/PipelineFlowDashboard"));
const OpportunityRadar = lazy(() => import("@/components/pipeline/OpportunityRadar"));

const PipelineManagerActions = lazy(() => import("@/components/pipeline/PipelineManagerActions"));
const PipelineTeamVisitas = lazy(() => import("@/components/pipeline/PipelineTeamVisitas"));
import { Send, X, Loader2 } from "lucide-react";
import PipelineAdvancedFilters, {
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  type PipelineFilters,
} from "@/components/pipeline/PipelineAdvancedFilters";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkActionModal from "@/components/pipeline/BulkActionModal";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchInBatchesWithRetry } from "@/lib/taskQueryUtils";
import { toast } from "sonner";
import { getLeadStatusFilter, isTaskHigherPriority, type LeadClientStatus, type ProximaTarefa } from "@/components/pipeline/CardStatusLine";
import FocusModeModal from "@/components/pipeline/FocusModeModal";
import { useFocusLeads } from "@/hooks/useFocusLeads";
import PipelineHeader from "@/components/pipeline/PipelineHeader";
import ModoTimePlaceholder from "@/components/pipeline/ModoTimePlaceholder";
import EquipesViewPlaceholder from "@/components/pipeline/EquipesViewPlaceholder";
import { GERENTES_REAIS } from "@/components/pipeline/header/PipelineGestorSelect";

// Campaign tag definitions
const CAMPAIGN_TAGS = [
  
  { tag: "OPEN_BOSQUE", label: "🌳 Open Bosque", color: "green" },
  { tag: "CASA_TUA", label: "🏠 Casa Tua", color: "blue" },
  { tag: "LAKE_EYRE", label: "💎 Lake Eyre", color: "purple" },
  { tag: "LAS_CASAS", label: "🏡 Las Casas", color: "amber" },
  { tag: "ORYGEM", label: "✨ Orygem", color: "cyan" },
  { tag: "HIGH_GARDEN_IGUATEMI", label: "🌿 High Garden Iguatemi", color: "emerald" },
  { tag: "SEEN_TRES_FIGUEIRAS", label: "👁 Seen Três Figueiras", color: "violet" },
  { tag: "ALTO_LINDOIA", label: "🏔 Alto Lindóia", color: "sky" },
  { tag: "SHIFT", label: "⚡ Shift", color: "slate" },
  { tag: "CASA_BASTIAN", label: "🏰 Casa Bastian", color: "rose" },
  { tag: "DUETTO", label: "🎵 Duetto", color: "indigo" },
  { tag: "TERRACE", label: "🌅 Terrace", color: "teal" },
];

type ClientStatusFilter = "todos" | LeadClientStatus;

export default function PipelineKanban() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const pipeline = usePipeline();
  const { isGestor, isAdmin, isCorretor, loading: roleLoading, roles } = useUserRole();
  const { user: authUser, loading: authLoading } = useAuth();
  // Bug-fix Bug 3: useUserRole retorna loading=false enquanto useAuth ainda
  // resolve user (query disabled => isLoading=false). Combinamos os dois para
  // garantir que o efeito de tab só decide depois das roles realmente prontas.
  const rolesReady = !authLoading && !roleLoading && (roles.length > 0 || !authUser);
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({ ...EMPTY_FILTERS });
  const { data: parcerias = {} } = useParceriasMap();
  const { data: partnerLeadsByCorretor = {} } = usePartnerLeadsByCorretor();
  // Tab default por role + persistência em localStorage (Fase 1 refactor visões)
  // Bug-fix: aguardar useUserRole resolver antes de inicializar/persistir
  // (sem isso, a primeira render usa roleKey="corretor" e persiste "kanban"
  //  na chave do admin/gestor — eternamente sobrescrevendo o default).
  const roleKey: "admin" | "gestor" | "corretor" = isAdmin ? "admin" : isGestor ? "gestor" : "corretor";
  const tabStorageKey = `uhome:pipeline-mode:${roleKey}`;
  const defaultTabForRole = isAdmin ? "equipes" : isGestor ? "time" : "kanban";
  const allowedTabsForRole: string[] = isAdmin
    ? ["equipes", "kanban", "inteligencia"]
    : isGestor
    ? ["time", "kanban", "inteligencia"]
    : ["kanban", "inteligencia"];
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Inicialização única após role resolver — com one-shot migration v2.
  useEffect(() => {
    if (!rolesReady) return;
    if (activeTab !== null) return;
    try {
      const MIGRATION_KEY = "uhome:pipeline-mode:migrated-v2";
      const alreadyMigrated = window.localStorage.getItem(MIGRATION_KEY);
      if (!alreadyMigrated && (isAdmin || isGestor)) {
        // Limpa valor poluído pelo bug pré-fix (provavelmente "kanban")
        window.localStorage.removeItem(tabStorageKey);
        window.localStorage.setItem(MIGRATION_KEY, "true");
        setActiveTab(defaultTabForRole);
        return;
      }
      const saved = window.localStorage.getItem(tabStorageKey);
      if (saved && allowedTabsForRole.includes(saved)) setActiveTab(saved);
      else setActiveTab(defaultTabForRole);
    } catch {
      setActiveTab(defaultTabForRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesReady, tabStorageKey, defaultTabForRole, isAdmin, isGestor]);

  useEffect(() => {
    if (!rolesReady || activeTab === null) return;
    try { window.localStorage.setItem(tabStorageKey, activeTab); } catch { /* ignore */ }
  }, [activeTab, tabStorageKey, rolesReady]);

  // Se a role mudou (login/logout) e o tab salvo não pertence ao role atual, força default.
  useEffect(() => {
    if (!rolesReady) return;
    if (activeTab !== null && !allowedTabsForRole.includes(activeTab)) {
      setActiveTab(defaultTabForRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey, rolesReady]);
  const [sortOrder, setSortOrder] = useState<SortOrder>(loadSortOrder);
  const [filaCeoFilter, setFilaCeoFilter] = useState(false);
  const [corretorFilter, setCorretorFilter] = useState<string>("all");
  const [campaignTagFilter, setCampaignTagFilter] = useState<string>("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>("todos");
  const [negociosFilter, setNegociosFilter] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filtro CEO por gestor (Fase 1) — restringe leads aos corretores daquele gestor.
  const [gestorFilter, setGestorFilter] = useState<string>("todos");
  const { data: gestorTeamUserIds } = useQuery({
    queryKey: ["pipeline-gestor-team", gestorFilter],
    queryFn: async () => {
      if (!isAdmin || gestorFilter === "todos") return null;
      const { data } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("gerente_id", gestorFilter)
        .eq("status", "ativo");
      return new Set((data || []).map((r: any) => r.user_id).filter(Boolean) as string[]);
    },
    enabled: isAdmin && gestorFilter !== "todos",
    staleTime: 5 * 60 * 1000,
  });
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchRef = React.useRef<HTMLInputElement>(null);

  // Focus mode leads count
  const { leads: focusLeads, reload: reloadFocusLeads } = useFocusLeads(authUser?.id ?? null, "leads");
  useEffect(() => { if (authUser?.id && !pipeline.loading) reloadFocusLeads(); }, [authUser?.id, pipeline.loading]);
  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLeads(new Set());
    setSelectionMode(false);
  }, []);

  // Auto-open lead from query param (e.g. ?lead=uuid)
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (leadId && pipeline.leads.length > 0) {
      const found = pipeline.leads.find(l => l.id === leadId);
      if (found) {
        setSelectedLead(found);
        searchParams.delete("lead");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, pipeline.leads]);

  // URL sync para ?filtro= (Pipeline v2 — Fase 2)
  // Padrão TabProvider: páginas que vivem em aba persistente precisam re-sync
  // quando URL muda sem remount. Mapeia URL→state interno (LeadClientStatus).
  // "negocios" é informacional (filter por stage) — fica pra Fase 6 implementar.
  useEffect(() => {
    const f = searchParams.get("filtro");
    const urlToInternal: Record<string, ClientStatusFilter> = {
      em_dia: "em_dia",
      sem_tarefa: "desatualizado",
      atrasado: "tarefa_atrasada",
    };
    if (f === "negocios") {
      if (!negociosFilter) setNegociosFilter(true);
      if (clientStatusFilter !== "todos") setClientStatusFilter("todos");
      return;
    }
    if (negociosFilter) setNegociosFilter(false);
    if (!f) return;
    const target = urlToInternal[f];
    if (target && target !== clientStatusFilter) {
      setClientStatusFilter(target);
    }
  }, [searchParams]);


  // Load tasks for status classification
  const leadIds = useMemo(() => pipeline.leads.map(l => l.id), [pipeline.leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const { data: kanbanTarefasMap = {}, isLoading: tarefasLoading } = useQuery({
    queryKey: ["pipeline-kanban-tarefas", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const map: Record<string, ProximaTarefa> = {};
      const { rows, errors } = await fetchInBatchesWithRetry<any>(
        leadIds,
        (chunk) =>
          supabase
            .from("pipeline_tarefas")
            .select("pipeline_lead_id, tipo, vence_em, hora_vencimento")
            .in("pipeline_lead_id", chunk)
            .eq("status", "pendente")
            .order("vence_em", { ascending: true })
            .order("hora_vencimento", { ascending: true }),
        { chunkSize: 50, minChunkSize: 10 }
      );

      for (const row of rows) {
        const nextTask: ProximaTarefa = { tipo: row.tipo, vence_em: row.vence_em, hora_vencimento: row.hora_vencimento };
        const currentTask = map[row.pipeline_lead_id];
        if (!currentTask || isTaskHigherPriority(nextTask, currentTask)) {
          map[row.pipeline_lead_id] = nextTask;
        }
      }

      if (errors.length) {
        console.warn("[PipelineKanban] Algumas consultas de tarefas falharam e foram isoladas por chunk", errors);
      }

      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  // Query real visitas for the "Visita marcada" filter
  const { data: visitaLeadIds } = useQuery({
    queryKey: ["pipeline-visita-lead-ids"],
    queryFn: async () => {
      const today = todayBRT();
      const { data } = await supabase
        .from("visitas")
        .select("pipeline_lead_id")
        .neq("status", "cancelada")
        .gte("data_visita", today);
      const ids = new Set<string>();
      if (data) {
        for (const row of data) {
          if (row.pipeline_lead_id) ids.add(row.pipeline_lead_id);
        }
      }
      return ids;
    },
    staleTime: 60_000,
  });

  const canAdd = isGestor || isAdmin || isCorretor;

  // Pre-filter leads (everything except clientStatusFilter) for accurate status counts
  const preFilteredLeads = useMemo(() => {
    let result = applyFilters(pipeline.leads, filters, pipeline.stages, visitaLeadIds, kanbanTarefasMap);
    if (filaCeoFilter) {
      result = result.filter(l => !l.corretor_id);
    }
    // Fase 1: filtro CEO por gestor — restringe ao time do gestor selecionado.
    if (isAdmin && gestorFilter !== "todos" && gestorTeamUserIds) {
      result = result.filter(l => l.corretor_id && gestorTeamUserIds.has(l.corretor_id));
    }
    if (corretorFilter && corretorFilter !== "all") {
      if (corretorFilter === "sem_corretor") {
        result = result.filter(l => !l.corretor_id);
      } else {
        // Inclui leads onde o corretor é principal OU parceiro,
        // alinhando com o que ele vê na própria tela de pipeline.
        const partnerLeadIds = partnerLeadsByCorretor[corretorFilter] || new Set<string>();
        result = result.filter(l => l.corretor_id === corretorFilter || partnerLeadIds.has(l.id));
      }
    }
    if (campaignTagFilter && campaignTagFilter !== "all") {
      result = result.filter(l => (l.tags || []).includes(campaignTagFilter));
    }
    return result;
  }, [pipeline.leads, filters, pipeline.stages, filaCeoFilter, corretorFilter, campaignTagFilter, visitaLeadIds, kanbanTarefasMap, partnerLeadsByCorretor, isAdmin, gestorFilter, gestorTeamUserIds]);

  const filteredLeads = useMemo(() => {
    const stageMap = new Map(pipeline.stages.map(s => [s.id, s.tipo]));
    let result = preFilteredLeads;
    if (negociosFilter) {
      result = result.filter(l => stageMap.get(l.stage_id) === "convertido");
    }
    if (clientStatusFilter !== "todos") {
      result = result.filter(l => getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null, stageMap.get(l.stage_id)) === clientStatusFilter);
    }
    return result;
  }, [preFilteredLeads, clientStatusFilter, negociosFilter, kanbanTarefasMap, pipeline.stages]);


  // Bug-fix Bug 4: corretorNomes é "poliglota" (indexa cada pessoa sob user_id
  // E profile.id) e inclui gerente_id dos leads — Object.entries() duplicaria
  // cada nome e vazaria gerentes de outros times. Construímos a lista a partir
  // dos corretor_id dos leads em escopo, deduplicando por nome.
  const corretorOptions = useMemo(() => {
    const ids = new Set<string>();
    pipeline.leads.forEach(l => { if (l.corretor_id) ids.add(l.corretor_id); });
    const byName = new Map<string, string>();
    ids.forEach(id => {
      const nome = pipeline.corretorNomes[id];
      if (nome && !byName.has(nome)) byName.set(nome, id);
    });
    return [...byName.entries()]
      .map(([nome, id]) => [id, nome] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [pipeline.leads, pipeline.corretorNomes]);

  const filaCeoCount = useMemo(() =>
    pipeline.leads.filter(l => !l.corretor_id).length,
    [pipeline.leads]
  );
  const filaCeoNovosCount = useMemo(() =>
    pipeline.leads.filter(l => !l.corretor_id && !(l as any).is_redistribuicao).length,
    [pipeline.leads]
  );
  const filaCeoRedistCount = useMemo(() =>
    pipeline.leads.filter(l => !l.corretor_id && !!(l as any).is_redistribuicao).length,
    [pipeline.leads]
  );
  const [dispatchInitialTab, setDispatchInitialTab] = useState<"novos" | "redistribuicao">("novos");
  const openDispatch = (tab: "novos" | "redistribuicao") => { setDispatchInitialTab(tab); setDispatchOpen(true); };

  const campaignTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ct of CAMPAIGN_TAGS) {
      const c = pipeline.leads.filter(l => (l.tags || []).includes(ct.tag)).length;
      if (c > 0) counts[ct.tag] = c;
    }
    return counts;
  }, [pipeline.leads]);

  // Client status counts — based on pre-filtered leads (respects corretor/campaign filters)
  const stageTypeById = useMemo(() => Object.fromEntries(pipeline.stages.map((s) => [s.id, s.tipo])), [pipeline.stages]);

  const clientStatusCounts = useMemo(() => {
    const counts = { em_dia: 0, desatualizado: 0, tarefa_atrasada: 0 };
    // Defesa: sem stages carregados, stageTypeById está vazio e a
    // classificação ficaria errada (tudo viraria "desatualizado"). Aguarda.
    if (pipeline.stages.length === 0) return counts;
    for (const l of preFilteredLeads) {
      const s = getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null, stageTypeById[l.stage_id]);
      counts[s]++;
    }
    return counts;
  }, [preFilteredLeads, kanbanTarefasMap, stageTypeById, pipeline.stages.length]);

  // Pílulas (Bug 1 fix): conta client-side a partir dos leads em escopo
  // — funciona para corretor, gestor e CEO (com/sem filtro de gestor).
  // Substitui os hooks `useCorretorKpisCarteira`/`useNegociosCount`, que
  // filtravam por `corretor_id = user.id` e zeravam para admin/gestor.
  const pillCounts = useMemo(() => {
    let negocios = 0;
    if (pipeline.stages.length > 0) {
      for (const l of preFilteredLeads) {
        if (stageTypeById[l.stage_id] === "convertido") negocios++;
      }
    }
    return {
      em_dia: clientStatusCounts.em_dia,
      sem_tarefa: clientStatusCounts.desatualizado,
      atrasado: clientStatusCounts.tarefa_atrasada,
      negocios,
    };
  }, [preFilteredLeads, stageTypeById, pipeline.stages.length, clientStatusCounts]);

  const lastStableClientStatusCountsRef = useRef(clientStatusCounts);
  const clientStatusCountsReady = pipeline.stages.length > 0 && (!leadIds.length || !tarefasLoading);

  useEffect(() => {
    if (!clientStatusCountsReady) return;
    lastStableClientStatusCountsRef.current = clientStatusCounts;
  }, [clientStatusCounts, clientStatusCountsReady]);

  const displayedClientStatusCounts = clientStatusCountsReady
    ? clientStatusCounts
    : lastStableClientStatusCountsRef.current;

  const activeFiltersCount = countActiveFilters(filters);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pipeline.reload();
    setRefreshing(false);
  };

  // Listen for pipeline-reload events from PipelineBoard (e.g. after descarte)
  useEffect(() => {
    const handler = () => pipeline.reload();
    window.addEventListener("pipeline-reload", handler);
    return () => window.removeEventListener("pipeline-reload", handler);
  }, [pipeline.reload]);

  const [intelView, setIntelView] = useState<"funil" | "radar">("funil");

  const clearAllFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setCampaignTagFilter("all");
    setClientStatusFilter("todos");
    setNegociosFilter(false);
    if (searchParams.get("filtro")) {
      searchParams.delete("filtro");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const hasAnyFilter = activeFiltersCount > 0 || campaignTagFilter !== "all" || clientStatusFilter !== "todos" || negociosFilter;


  if (pipeline.loading || !rolesReady || activeTab === null) {
    return (
      <LoadingState
        title="Carregando pipeline..."
        description="Buscando leads e etapas do funil."
      />
    );
  }

  // Só mostra tela de erro se houver erro REAL informado pelo hook.
  // Stages vazios sem erro = ainda pode estar carregando ou rede flapou silenciosamente —
  // não vamos mais transformar isso em "Nenhuma etapa foi encontrada" indevido.
  if (pipeline.error) {
    return (
      <ErrorState
        title="Erro ao carregar o Pipeline"
        description={pipeline.error}
        action={{ label: "Tentar novamente", onClick: () => pipeline.reload() }}
      />
    );
  }

  if (!pipeline.stages || pipeline.stages.length === 0) {
    // Sem stages e sem erro: provavelmente recarga em andamento após uma falha de rede.
    // Mostra um loading discreto em vez do erro vermelho que assustava o usuário.
    return (
      <LoadingState
        title="Sincronizando pipeline..."
        description="Aguarde alguns segundos."
      />
    );
  }

  return (
    <ErrorBoundary fallback={
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="text-destructive font-semibold">Erro ao carregar o Pipeline</span>
        <span className="text-sm text-muted-foreground">Tente recarregar a página (Ctrl+F5)</span>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Recarregar</button>
      </div>
    } onError={(err) => console.error("[PipelineKanban] Render crash:", err.message, err.stack)}>
    <div
      className="flex flex-col w-full max-w-full min-w-0 overflow-hidden bg-[#f0f0f5] dark:bg-[#0e1525] px-2 pt-2"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* Badge de cache antigo — só renderiza se staleSince !== null. ErrorBoundary interno. */}
      <StaleDataBadge
        staleSince={pipeline.staleSince}
        onRetry={() => pipeline.reload()}
      />
      {/* ═══ HEADER (Fase 6: extraído para PipelineHeader.tsx) ═══ */}
      <PipelineHeader
        filteredLeadsCount={filteredLeads.length}
        displayedClientStatusCounts={displayedClientStatusCounts}
        pillCounts={pillCounts}
        campaignTagCounts={campaignTagCounts}
        campaignTags={CAMPAIGN_TAGS}
        pipelineStages={pipeline.stages}
        pipelineSegmentos={pipeline.segmentos}
        pipelineLeads={pipeline.leads}
        corretorNomes={pipeline.corretorNomes}
        corretorOptions={corretorOptions}
        visitaLeadIds={visitaLeadIds}
        focusLeadsCount={focusLeads.length}
        filaCeoCount={filaCeoCount}
        filaCeoNovosCount={filaCeoNovosCount}
        filaCeoRedistCount={filaCeoRedistCount}
        isAdmin={isAdmin}
        isGestor={isGestor}
        canAdd={canAdd}
        filters={filters}
        setFilters={setFilters}
        corretorFilter={corretorFilter}
        setCorretorFilter={setCorretorFilter}
        campaignTagFilter={campaignTagFilter}
        setCampaignTagFilter={setCampaignTagFilter}
        clientStatusFilter={clientStatusFilter}
        setClientStatusFilter={setClientStatusFilter}
        negociosFilter={negociosFilter}
        setNegociosFilter={setNegociosFilter}
        hasAnyFilter={hasAnyFilter}
        clearAllFilters={clearAllFilters}
        activeTab={activeTab as string}
        setActiveTab={setActiveTab as (v: string) => void}
        intelView={intelView}
        setIntelView={setIntelView}
        refreshing={refreshing}
        handleRefresh={handleRefresh}
        setAddOpen={setAddOpen}
        setFocusModeOpen={setFocusModeOpen}
        filaCeoFilter={filaCeoFilter}
        setFilaCeoFilter={setFilaCeoFilter}
        openDispatch={openDispatch}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        clearSelection={clearSelection}
        mobileSearchOpen={mobileSearchOpen}
        setMobileSearchOpen={setMobileSearchOpen}
        mobileSearchRef={mobileSearchRef}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        gestorFilter={gestorFilter}
        setGestorFilter={setGestorFilter}
      />


      {/* Active filter badges row — hidden on mobile kanban */}
      {hasAnyFilter && !(isMobile && activeTab === "kanban") && (
        <div className="flex items-center gap-1 flex-wrap shrink-0" style={{ padding: "6px 28px 0" }}>
          {filters.temperaturas.length > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, temperaturas: [] }))}>
              Temp ×
            </Badge>
          )}
          {filters.scoreMin > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, scoreMin: 0 }))}>
              Score≥{filters.scoreMin} ×
            </Badge>
          )}
          {filters.stages.length > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, stages: [] }))}>
              {filters.stages.length} etapas ×
            </Badge>
          )}
          {filters.origens.length > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, origens: [] }))}>
              {filters.origens.length} origens ×
            </Badge>
          )}
          {filters.segmentos.length > 0 && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, segmentos: [] }))}>
              {filters.segmentos.length} seg ×
            </Badge>
          )}
          {filters.diasSemAcao && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, diasSemAcao: "" }))}>
              &gt;{filters.diasSemAcao}d ×
            </Badge>
          )}
          {filters.periodoEntrada && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, periodoEntrada: "" }))}>
              Período ×
            </Badge>
          )}
          {filters.slaStatus && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, slaStatus: "" }))}>
              SLA ×
            </Badge>
          )}
          {filters.comVisita && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setFilters(f => ({ ...f, comVisita: "" }))}>
              Visita ×
            </Badge>
          )}
          {campaignTagFilter !== "all" && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setCampaignTagFilter("all")}>
              🏷️ {CAMPAIGN_TAGS.find(c => c.tag === campaignTagFilter)?.label || campaignTagFilter} ×
            </Badge>
          )}
          {clientStatusFilter !== "todos" && (
            <Badge variant="secondary" className="text-[9px] gap-0.5 cursor-pointer h-5" onClick={() => setClientStatusFilter("todos")}>
              {clientStatusFilter === "em_dia" ? "✅ Em dia" : clientStatusFilter === "desatualizado" ? "🟡 Desatualizado" : "🔴 Atrasado"} ×
            </Badge>
          )}
        </div>
      )}

      {/* PipelineManagerActions e PipelineTeamVisitas movidos para Modo Time (Fase 2).
          Imports lazy preservados para reuso. */}




      {/* Content area */}
      {isMobile && activeTab === "kanban" ? (
        <PipelineMobileView
          stages={pipeline.stages || []}
          leads={filteredLeads || []}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          corretorAvatars={pipeline.corretorAvatars}
          parcerias={parcerias}
          onMoveLead={pipeline.moveLead}
          onSelectLead={selectionMode ? (lead) => toggleLeadSelection(lead.id) : setSelectedLead}
          onTransferred={() => pipeline.reload()}
          selectionMode={selectionMode}
          selectedLeads={selectedLeads}
          onToggleSelect={toggleLeadSelection}
          clientStatusCounts={clientStatusCounts}
          clientStatusFilter={clientStatusFilter}
          onStatusFilterChange={(f) => setClientStatusFilter(f as ClientStatusFilter)}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex" style={{ padding: "0 16px" }}>
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
            <ErrorBoundary onError={(err) => console.error("[PipelineBoard] Render crash:", err.message, err.stack)}>
            <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#94A3B8" }} /></div>}>
              {activeTab === "kanban" ? (
                <PipelineBoard
                  stages={pipeline.stages || []}
                  leads={filteredLeads || []}
                  segmentos={pipeline.segmentos}
                  corretorNomes={pipeline.corretorNomes}
                  corretorAvatars={pipeline.corretorAvatars}
                  parcerias={parcerias}
                  onMoveLead={pipeline.moveLead}
                  onSelectLead={selectionMode ? (lead) => toggleLeadSelection(lead.id) : setSelectedLead}
                  onTransferred={() => pipeline.reload()}
                  selectionMode={selectionMode}
                  selectedLeads={selectedLeads}
                  onToggleSelect={toggleLeadSelection}
                  sortOrder={sortOrder}
                  tarefasMap={kanbanTarefasMap}
                />
              ) : activeTab === "inteligencia" ? (
                intelView === "funil" ? (
                  <PipelineFlowDashboard
                    stages={pipeline.stages}
                    leads={filteredLeads}
                    corretorNomes={pipeline.corretorNomes}
                  />
                ) : (
                  <OpportunityRadar
                    leads={pipeline.leads}
                    stages={pipeline.stages}
                    corretorNomes={pipeline.corretorNomes}
                    onSelectLead={setSelectedLead}
                  />
                )
              ) : activeTab === "time" ? (
                <ModoTimePlaceholder />
              ) : activeTab === "equipes" ? (
                <EquipesViewPlaceholder />
              ) : null}
            </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {canAdd && (
        <PipelineAddLeadDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          stages={pipeline.stages}
          segmentos={pipeline.segmentos}
          onAdd={pipeline.addLead}
        />
      )}

      {selectedLead && (
        <PipelineLeadDetail
          lead={selectedLead}
          stages={pipeline.stages}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          open={!!selectedLead}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedLead(null);
              queryClient.invalidateQueries({ queryKey: ["pipeline-tarefas-map"] });
              pipeline.reload();
            }
          }}
          onUpdate={pipeline.updateLead}
          onMove={pipeline.moveLead}
          onDelete={pipeline.deleteLead}
        />
      )}

      {/* Fila CEO Dispatch Modal */}
      <FilaCeoDispatchModal
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        initialTab={dispatchInitialTab}
        onDispatched={() => pipeline.reload()}
      />

      {/* Bulk Action Modal */}
      <BulkActionModal
        open={bulkActionOpen}
        onOpenChange={setBulkActionOpen}
        selectedLeadIds={[...selectedLeads]}
        onComplete={() => {
          clearSelection();
          pipeline.reload();
        }}
      />


      {selectionMode && selectedLeads.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-[14px] bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 shadow-lg"
        >
          <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
            {selectedLeads.size} selecionado{selectedLeads.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setBulkActionOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[10px] px-4 py-2 font-bold text-xs border-none cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" /> Ações em Massa
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 bg-transparent text-red-600 border-none font-semibold text-xs cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        </div>
      )}

      <FocusModeModal
        open={focusModeOpen}
        onClose={() => { setFocusModeOpen(false); pipeline.reload(); }}
        pipelineTipo="leads"
      />
    </div>
    </ErrorBoundary>
  );
}
