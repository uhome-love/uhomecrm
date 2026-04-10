import React, { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { LoadingState, ErrorState } from "@/components/ui/screen-states";
import PeriodBadge from "@/components/PeriodBadge";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineMobileView from "@/components/pipeline/PipelineMobileView";
import { useIsMobile } from "@/hooks/use-mobile";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useParceriasMap } from "@/hooks/useParcerias";

const PipelineFlowDashboard = lazy(() => import("@/components/pipeline/PipelineFlowDashboard"));
const OpportunityRadar = lazy(() => import("@/components/pipeline/OpportunityRadar"));
const MelnickCampaignAnalytics = lazy(() => import("@/components/pipeline/MelnickCampaignAnalytics"));
const PipelineManagerActions = lazy(() => import("@/components/pipeline/PipelineManagerActions"));
const PipelineTeamVisitas = lazy(() => import("@/components/pipeline/PipelineTeamVisitas"));
import { CheckSquare, Square, Send, X, Zap } from "lucide-react";
import PipelineAdvancedFilters, {
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  type PipelineFilters,
} from "@/components/pipeline/PipelineAdvancedFilters";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, BarChart3, Radar, Brain, Rocket } from "lucide-react";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkActionModal from "@/components/pipeline/BulkActionModal";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getLeadStatusFilter, isTaskHigherPriority, type LeadClientStatus, type ProximaTarefa } from "@/components/pipeline/CardStatusLine";
import FocusModeModal from "@/components/pipeline/FocusModeModal";
import { useFocusLeads } from "@/hooks/useFocusLeads";

// Campaign tag definitions
const CAMPAIGN_TAGS = [
  { tag: "MELNICK_DAY", label: "🔥 Melnick Day", color: "orange" },
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
  const { isGestor, isAdmin, isCorretor } = useUserRole();
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({ ...EMPTY_FILTERS });
  const { data: parcerias = {} } = useParceriasMap();
  const [activeTab, setActiveTab] = useState("kanban");
  const [filaCeoFilter, setFilaCeoFilter] = useState(false);
  const [corretorFilter, setCorretorFilter] = useState<string>("all");
  const [campaignTagFilter, setCampaignTagFilter] = useState<string>("all");
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientStatusFilter>("todos");
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
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

  // Load tasks for status classification
  const leadIds = useMemo(() => pipeline.leads.map(l => l.id), [pipeline.leads]);
  const leadIdsKey = useMemo(() => leadIds.slice().sort().join(","), [leadIds]);
  const { data: kanbanTarefasMap = {} } = useQuery({
    queryKey: ["pipeline-kanban-tarefas", leadIdsKey],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      const map: Record<string, ProximaTarefa> = {};
      // Build all chunk queries and run in parallel
      const chunkPromises = [];
      for (let i = 0; i < leadIds.length; i += 200) {
        const chunk = leadIds.slice(i, i + 200);
        chunkPromises.push(
          supabase
            .from("pipeline_tarefas")
            .select("pipeline_lead_id, tipo, vence_em, hora_vencimento")
            .in("pipeline_lead_id", chunk)
            .eq("status", "pendente")
            .order("vence_em", { ascending: true })
            .order("hora_vencimento", { ascending: true })
        );
      }
      const results = await Promise.all(chunkPromises);
      for (const { data } of results) {
        if (data) {
          for (const row of data) {
            const nextTask: ProximaTarefa = { tipo: row.tipo, vence_em: row.vence_em, hora_vencimento: row.hora_vencimento };
            const currentTask = map[row.pipeline_lead_id];
            if (!currentTask || isTaskHigherPriority(nextTask, currentTask)) {
              map[row.pipeline_lead_id] = nextTask;
            }
          }
        }
      }
      return map;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });

  const canAdd = isGestor || isAdmin || isCorretor;

  // Pre-filter leads (everything except clientStatusFilter) for accurate status counts
  const preFilteredLeads = useMemo(() => {
    let result = applyFilters(pipeline.leads, filters, pipeline.stages);
    if (filaCeoFilter) {
      result = result.filter(l => !l.corretor_id);
    }
    if (corretorFilter && corretorFilter !== "all") {
      if (corretorFilter === "sem_corretor") {
        result = result.filter(l => !l.corretor_id);
      } else {
        result = result.filter(l => l.corretor_id === corretorFilter);
      }
    }
    if (campaignTagFilter && campaignTagFilter !== "all") {
      result = result.filter(l => (l.tags || []).includes(campaignTagFilter));
    }
    return result;
  }, [pipeline.leads, filters, pipeline.stages, filaCeoFilter, corretorFilter, campaignTagFilter]);

  const filteredLeads = useMemo(() => {
    if (clientStatusFilter !== "todos") {
      const stageMap = new Map(pipeline.stages.map(s => [s.id, s.tipo]));
      return preFilteredLeads.filter(l => getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null, stageMap.get(l.stage_id)) === clientStatusFilter);
    }
    return preFilteredLeads;
  }, [preFilteredLeads, clientStatusFilter, kanbanTarefasMap]);

  const corretorOptions = useMemo(() => {
    const entries = Object.entries(pipeline.corretorNomes).sort((a, b) => a[1].localeCompare(b[1]));
    return entries;
  }, [pipeline.corretorNomes]);

  const filaCeoCount = useMemo(() =>
    pipeline.leads.filter(l => !l.corretor_id).length,
    [pipeline.leads]
  );

  const campaignTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ct of CAMPAIGN_TAGS) {
      const c = pipeline.leads.filter(l => (l.tags || []).includes(ct.tag)).length;
      if (c > 0) counts[ct.tag] = c;
    }
    return counts;
  }, [pipeline.leads]);

  // Client status counts — based on pre-filtered leads (respects corretor/campaign filters)
  const clientStatusCounts = useMemo(() => {
    const counts = { em_dia: 0, desatualizado: 0, tarefa_atrasada: 0 };
    const stageMap = new Map(pipeline.stages.map(s => [s.id, s.tipo]));
    for (const l of preFilteredLeads) {
      const s = getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null, stageMap.get(l.stage_id));
      counts[s]++;
    }
    return counts;
  }, [preFilteredLeads, kanbanTarefasMap, pipeline.stages]);

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
  };

  const hasAnyFilter = activeFiltersCount > 0 || campaignTagFilter !== "all" || clientStatusFilter !== "todos";

  if (pipeline.loading) {
    return (
      <LoadingState
        title="Carregando pipeline..."
        description="Buscando leads e etapas do funil."
      />
    );
  }

  if (pipeline.error || !pipeline.stages || pipeline.stages.length === 0) {
    return (
      <ErrorState
        title="Erro ao carregar o Pipeline"
        description={pipeline.error || "Nenhuma etapa foi encontrada. Tente recarregar."}
        action={{ label: "Tentar novamente", onClick: () => pipeline.reload() }}
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
      className="flex flex-col w-full max-w-full min-w-0 overflow-hidden bg-[#f0f0f5] dark:bg-[#0e1525]"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ═══ HEADER ═══ */}
      <div
        className="shrink-0 bg-[#f7f7fb] dark:bg-[#141e30] border-b border-[#e8e8f0] dark:border-white/[0.07] sticky top-0 z-40"
      >
        {/* ── MOBILE HEADER (< md) ── */}
        <div className="md:hidden">
          {/* Line 1: Title + filters + novo */}
          <div className="flex items-center gap-2 h-[46px] px-3">
            <div className="h-6 w-6 rounded-md bg-[#4F46E5] flex items-center justify-center shrink-0">
              <LayoutGrid className="h-3 w-3 text-white" />
            </div>
            <span className="text-[15px] font-bold text-slate-800 dark:text-slate-100">Pipeline</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{filteredLeads.length}</span>
            <div className="flex-1" />

            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className={`h-7 text-[10px] w-[100px] shrink-0 rounded-[7px] text-[10px] font-semibold ${
                    corretorFilter !== "all"
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <SelectValue placeholder="Corretor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {isAdmin && <SelectItem value="sem_corretor">Sem corretor</SelectItem>}
                  {corretorOptions.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <PipelineAdvancedFilters
              filters={filters}
              onChange={setFilters}
              stages={pipeline.stages}
              segmentos={pipeline.segmentos}
              leads={pipeline.leads}
              corretorNomes={pipeline.corretorNomes}
              isManager={isGestor || isAdmin}
            />

            {/* Mobile search toggle */}
            <button
              onClick={() => {
                setMobileSearchOpen(v => !v);
                setTimeout(() => mobileSearchRef.current?.focus(), 100);
              }}
              className="relative w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer"
            >
              <Search className="h-3 w-3 text-slate-500 dark:text-slate-400" />
              {filters.search && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-[7px] px-2.5 py-[5px] font-bold text-xs border-none cursor-pointer whitespace-nowrap"
              >
                + Novo
              </button>
            )}
          </div>

          {/* Mobile search bar (expandable) */}
          {(mobileSearchOpen || filters.search) && (
            <div className="flex items-center gap-2 px-3 py-1.5 animate-fade-in border-b border-slate-200 dark:border-gray-700">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
              <input
                ref={mobileSearchRef}
                type="text"
                placeholder="Buscar lead por nome, telefone..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 outline-none h-7"
              />
              <button
                onClick={() => {
                  setFilters(f => ({ ...f, search: "" }));
                  setMobileSearchOpen(false);
                }}
                className="bg-transparent border-none cursor-pointer p-0.5"
              >
                <X className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>
          )}

          {/* Line 2 mobile: Status chips compact */}
          <div className="flex items-center gap-3 px-3 pb-2 border-b border-slate-200 dark:border-gray-700">
            <button
              onClick={() => setClientStatusFilter(f => f === "em_dia" ? "todos" : "em_dia")}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-transparent border-none cursor-pointer"
            >
              <div className="w-[5px] h-[5px] rounded-full bg-emerald-600" />
              {clientStatusCounts.em_dia}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-transparent border-none cursor-pointer"
            >
              <div className="w-[5px] h-[5px] rounded-full bg-amber-600" />
              {clientStatusCounts.desatualizado}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
              className="flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-transparent border-none cursor-pointer"
            >
              <div className="w-[5px] h-[5px] rounded-full bg-red-600" />
              {clientStatusCounts.tarefa_atrasada}
            </button>
            <div className="flex-1" />
            {hasAnyFilter && (
              <button onClick={clearAllFilters} className="text-[10px] font-semibold text-red-600 bg-transparent border-none cursor-pointer">
                <X className="h-[10px] w-[10px] inline" /> Limpar
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-6 h-6 rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── TABLET HEADER (md to lg) ── */}
        <div className="hidden md:block lg:hidden">
          <div className="flex items-center gap-2 h-12 px-4 border-b border-slate-200 dark:border-gray-700">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Pipeline</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{filteredLeads.length}</span>

            <div className="flex-1" />

            {/* Tab switcher - icons only */}
            <div className="flex items-center bg-slate-100 dark:bg-gray-800 rounded-[7px] p-0.5">
              {[
                { key: "kanban", icon: <LayoutGrid className="h-3 w-3" />, label: "Kanban" },
                { key: "inteligencia", icon: <Brain className="h-3 w-3" />, label: "Intel" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  title={tab.label}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border-none cursor-pointer ${
                    activeTab === tab.key
                      ? "bg-white dark:bg-gray-700 shadow-sm text-slate-800 dark:text-slate-100"
                      : "bg-transparent text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden xl:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className={`h-7 text-[10px] w-[110px] shrink-0 rounded-[7px] font-semibold ${
                    corretorFilter !== "all"
                      ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <SelectValue placeholder="Corretores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {isAdmin && <SelectItem value="sem_corretor">Sem corretor</SelectItem>}
                  {corretorOptions.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <PipelineAdvancedFilters
              filters={filters}
              onChange={setFilters}
              stages={pipeline.stages}
              segmentos={pipeline.segmentos}
              leads={pipeline.leads}
              corretorNomes={pipeline.corretorNomes}
              isManager={isGestor || isAdmin}
            />

            <div className="relative w-[120px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 dark:text-slate-500" />
              <input
                placeholder="Buscar..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full outline-none h-[30px] rounded-[7px] bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 pl-[26px] pr-2 text-[11px] font-medium text-slate-800 dark:text-slate-100"
              />
            </div>

            <button onClick={handleRefresh} disabled={refreshing} className="w-7 h-7 rounded-[7px] border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center cursor-pointer">
              <RefreshCw className={`h-3 w-3 text-slate-500 dark:text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 py-1.5 font-bold text-[11px] border-none cursor-pointer whitespace-nowrap"
              >
                + Novo Lead
              </button>
            )}
          </div>

          {/* Tablet line 2: status chips + fila ceo */}
          <div className="flex items-center gap-2 overflow-x-auto h-8 px-4">
            {/* Status chips */}
            {[
              { key: "em_dia" as const, label: "Em dia", color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950", border: "border-emerald-300 dark:border-emerald-800", count: clientStatusCounts.em_dia },
              { key: "desatualizado" as const, label: "Desatual.", color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-300 dark:border-amber-800", count: clientStatusCounts.desatualizado },
              { key: "tarefa_atrasada" as const, label: "Atrasado", color: "#DC2626", bg: "bg-red-50 dark:bg-red-950", border: "border-red-300 dark:border-red-800", count: clientStatusCounts.tarefa_atrasada },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => setClientStatusFilter(f => f === chip.key ? "todos" : chip.key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer whitespace-nowrap border ${
                  clientStatusFilter === chip.key ? `${chip.bg} ${chip.border}` : "bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700"
                }`}
                style={{ color: chip.color }}
              >
                <div className="w-[5px] h-[5px] rounded-full" style={{ background: chip.color }} />
                {chip.label} {chip.count > 0 && chip.count}
              </button>
            ))}

            {isAdmin && filaCeoCount > 0 && (
              <>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer whitespace-nowrap border ${
                    filaCeoFilter
                      ? "bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-800"
                      : "bg-white dark:bg-gray-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-gray-700"
                  }`}
                >
                  📥 CEO {filaCeoCount}
                </button>
                <button
                  onClick={() => setDispatchOpen(true)}
                  className="flex items-center gap-1 h-5 px-1.5 rounded-md text-[9px] font-bold bg-violet-600 text-white border-none cursor-pointer"
                >
                  <Rocket className="h-[10px] w-[10px]" /> Disparar
                </button>
              </>
            )}

            {isAdmin && activeTab === "kanban" && (
              <button
                onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
                className={`h-[22px] rounded-md px-2 text-[10px] font-semibold cursor-pointer flex items-center gap-1 border ${
                  selectionMode
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {selectionMode ? <CheckSquare className="h-[10px] w-[10px]" /> : <Square className="h-[10px] w-[10px]" />}
                {selectionMode ? "Selec..." : "Selec."}
              </button>
            )}

            {hasAnyFilter && (
              <button onClick={clearAllFilters} className="text-[9px] font-semibold text-red-600 bg-transparent border-none cursor-pointer flex items-center gap-0.5">
                <X className="h-[9px] w-[9px]" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* ── DESKTOP HEADER (lg+) ── */}
        <div className="hidden lg:block">
          {/* Line 1 — Title + Filters + Search + Novo Lead */}
          <div className="flex items-center h-12 px-6 border-b border-[#e8e8f0] dark:border-white/[0.07] gap-2">
            {/* LEFT: Title */}
            <div className="flex items-center flex-shrink-0 gap-2 min-w-0">
              <div className="w-7 h-7 rounded-[7px] bg-[#4F46E5] flex items-center justify-center shrink-0">
                <LayoutGrid size={13} strokeWidth={1.5} className="text-white" />
              </div>
              <span className="text-[15px] font-bold text-[#0a0a0a] dark:text-white tracking-tight whitespace-nowrap">
                Pipeline
              </span>
              <span className="text-[12px] text-[#a1a1aa] dark:text-[#52525b] font-medium shrink-0">{filteredLeads.length} leads</span>
            </div>

            <div className="flex-1" />

            {/* CENTER-RIGHT: Filters inline */}
            <div className="flex items-center gap-1.5">
              {(isAdmin || isGestor) && (
                <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                  <SelectTrigger
                    className={`h-[32px] text-[12px] w-[170px] shrink-0 rounded-lg font-medium ${
                      corretorFilter !== "all"
                        ? "border-[#4F46E5] bg-[#4F46E5]/5 dark:bg-[#4F46E5]/10 text-[#4F46E5]"
                        : "border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa]"
                    }`}
                  >
                    <SelectValue placeholder="Todos os corretores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os corretores</SelectItem>
                    {isAdmin && <SelectItem value="sem_corretor">Sem corretor</SelectItem>}
                    {corretorOptions.map(([id, nome]) => (
                      <SelectItem key={id} value={id}>{nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {Object.keys(campaignTagCounts).length > 0 && (
                <Select value={campaignTagFilter} onValueChange={setCampaignTagFilter}>
                  <SelectTrigger
                    className={`h-[32px] text-[12px] w-[160px] shrink-0 rounded-lg font-medium ${
                      campaignTagFilter !== "all"
                        ? "border-[#4F46E5] bg-[#4F46E5]/5 dark:bg-[#4F46E5]/10 text-[#4F46E5]"
                        : "border-[#e8e8f0] dark:border-white/[0.07] bg-[#f7f7fb] dark:bg-white/[0.04] text-[#52525b] dark:text-[#a1a1aa]"
                    }`}
                  >
                    <SelectValue placeholder="Todas as origens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as campanhas</SelectItem>
                    {CAMPAIGN_TAGS.filter(ct => campaignTagCounts[ct.tag]).map(ct => (
                      <SelectItem key={ct.tag} value={ct.tag}>
                        {ct.label} ({campaignTagCounts[ct.tag]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Search */}
              <div className="relative transition-all duration-200" style={{ width: filters.search ? 200 : 160 }}>
                <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] dark:text-[#52525b]" />
                <input
                  placeholder="Buscar..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="w-full outline-none h-8 rounded-lg bg-[#f7f7fb] dark:bg-white/[0.04] border border-[#e8e8f0] dark:border-white/[0.07] pl-7 pr-2 text-xs font-medium text-[#0a0a0a] dark:text-white transition-all duration-200 focus:border-[#4F46E5] dark:focus:border-[#4F46E5]"
                />
                {filters.search && (
                  <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-[#a1a1aa] dark:text-[#52525b]" />
                  </button>
                )}
              </div>

              {/* Modo Foco */}
              {activeTab === "kanban" && (
                <button
                  onClick={() => setFocusModeOpen(true)}
                  className="whitespace-nowrap flex items-center gap-1.5 transition-colors h-8 px-3 rounded-lg font-semibold text-xs border-none cursor-pointer text-white"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                >
                  <Zap size={13} strokeWidth={2} /> Modo Foco
                  {focusLeads.length > 0 && (
                    <span className="bg-white/20 rounded-md px-1.5 py-px text-[10px] font-bold">
                      {focusLeads.length}
                    </span>
                  )}
                </button>
              )}

              {/* Novo Lead */}
              {canAdd && activeTab === "kanban" && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="whitespace-nowrap flex items-center gap-1.5 transition-colors h-8 px-3.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg font-semibold text-xs border-none cursor-pointer"
                >
                  <Plus size={13} strokeWidth={2} /> Novo Lead
                </button>
              )}
            </div>
          </div>

          {/* Line 2 — Views + actions + indicators — fixed 32px */}
          <div className="flex items-center overflow-x-auto h-8 px-6 gap-1">
            {/* View switcher */}
            {[
              { key: "kanban", icon: <LayoutGrid size={12} strokeWidth={1.5} />, label: "Kanban" },
              { key: "inteligencia", icon: <Brain size={12} strokeWidth={1.5} />, label: "Inteligência" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 shrink-0 transition-colors h-7 px-2.5 rounded-[7px] text-xs border-none cursor-pointer ${
                  activeTab === tab.key
                    ? "bg-[#4F46E5] text-white font-semibold"
                    : "bg-transparent text-[#71717a] dark:text-[#a1a1aa] font-medium"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}

            {activeTab === "inteligencia" && (
              <div className="flex items-center bg-[#f0f0f5] dark:bg-gray-800 rounded-[7px] p-0.5 ml-0.5">
                {[
                  { key: "funil", icon: <BarChart3 className="h-3 w-3 inline mr-1" />, label: "Funil" },
                  { key: "radar", icon: <Radar className="h-3 w-3 inline mr-1" />, label: "Radar" },
                ].map(v => (
                  <button
                    key={v.key}
                    onClick={() => setIntelView(v.key as any)}
                    className={`px-2 py-[3px] rounded-md text-[11px] font-semibold border-none cursor-pointer ${
                      intelView === v.key
                        ? "bg-white dark:bg-gray-700 text-[#0a0a0a] dark:text-white"
                        : "bg-transparent text-[#71717a] dark:text-[#a1a1aa]"
                    }`}
                  >
                    {v.icon}{v.label}
                  </button>
                ))}
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0 flex items-center justify-center transition-colors w-7 h-7 rounded-[7px] text-[#a1a1aa] dark:text-[#52525b] bg-transparent border-none cursor-pointer"
            >
              <RefreshCw size={12} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
            </button>

            {isAdmin && activeTab === "kanban" && (
              <button
                onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
                className={`flex items-center gap-1.5 shrink-0 transition-colors h-7 px-2.5 rounded-[7px] text-xs font-medium border-none cursor-pointer ${
                  selectionMode
                    ? "bg-[#4F46E5] text-white"
                    : "bg-transparent text-[#71717a] dark:text-[#a1a1aa]"
                }`}
              >
                {selectionMode ? <CheckSquare size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
                {selectionMode ? "Selecionando..." : "Selecionar"}
              </button>
            )}

            {/* Separator */}
            {isAdmin && filaCeoCount > 0 && (
              <>
                <div className="w-px h-4 bg-[#e8e8f0] dark:bg-white/[0.07] mx-1 shrink-0" />
                <span className="text-[11px] text-[#a1a1aa] dark:text-[#52525b]">Fila CEO</span>
                <span className="text-[11px] font-bold text-[#4F46E5]">{filaCeoCount}</span>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  className={`shrink-0 flex items-center gap-1 transition-colors h-[22px] px-1.5 rounded-md text-[10px] font-bold cursor-pointer border ${
                    filaCeoFilter
                      ? "bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]"
                      : "bg-transparent text-[#a1a1aa] dark:text-[#52525b] border-[#e8e8f0] dark:border-white/[0.07]"
                  }`}
                >
                  {filaCeoFilter ? "Filtrando" : "Filtrar"}
                </button>
                <button
                  onClick={() => setDispatchOpen(true)}
                  className="shrink-0 flex items-center gap-1.5 transition-colors h-7 px-2.5 rounded-[7px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[11px] font-semibold border-none cursor-pointer"
                >
                  <Rocket size={11} strokeWidth={1.5} /> Disparar
                </button>
              </>
            )}

            <div className="flex-1" />

            {/* Indicators */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setClientStatusFilter(f => f === "em_dia" ? "todos" : "em_dia")}
                className={`flex items-center gap-1 transition-opacity text-[11px] font-semibold text-[#10b981] bg-transparent border-none cursor-pointer ${clientStatusFilter === "em_dia" ? "opacity-100" : "opacity-70"}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                {clientStatusCounts.em_dia.toLocaleString("pt-BR")}
              </button>
              <button
                onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
                className={`flex items-center gap-1 transition-opacity text-[11px] font-semibold text-[#f59e0b] bg-transparent border-none cursor-pointer ${clientStatusFilter === "desatualizado" ? "opacity-100" : "opacity-70"}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                {clientStatusCounts.desatualizado.toLocaleString("pt-BR")}
              </button>
              <button
                onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
                className={`flex items-center gap-1 transition-opacity text-[11px] font-semibold text-[#ef4444] bg-transparent border-none cursor-pointer ${clientStatusFilter === "tarefa_atrasada" ? "opacity-100" : "opacity-70"}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                {clientStatusCounts.tarefa_atrasada.toLocaleString("pt-BR")}
              </button>
            </div>

            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-[#ef4444] bg-transparent border-none cursor-pointer"
              >
                <X size={10} strokeWidth={1.5} /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

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

      {/* Manager actions */}
      {activeTab === "kanban" && isGestor && !isAdmin && (
        <div style={{ padding: "0 28px" }}>
          <PipelineManagerActions
            leads={pipeline.leads}
            corretorNomes={pipeline.corretorNomes}
          />
        </div>
      )}

      {/* Team visits for managers */}
      {activeTab === "kanban" && (isGestor || isAdmin) && (
        <div style={{ padding: "4px 28px 0" }}>
          <Suspense fallback={null}>
            <PipelineTeamVisitas />
          </Suspense>
        </div>
      )}

      {/* Melnick Campaign Analytics */}
      {campaignTagFilter === "MELNICK_DAY" && (
        <div style={{ padding: "0 28px" }}>
          <Suspense fallback={null}>
            <MelnickCampaignAnalytics />
          </Suspense>
        </div>
      )}

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
