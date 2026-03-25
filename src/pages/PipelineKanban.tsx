import { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
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
      return preFilteredLeads.filter(l => getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null) === clientStatusFilter);
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
    for (const l of preFilteredLeads) {
      const s = getLeadStatusFilter(l, kanbanTarefasMap[l.id] || null);
      counts[s]++;
    }
    return counts;
  }, [preFilteredLeads, kanbanTarefasMap]);

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
      className="flex flex-col w-full max-w-full min-w-0 overflow-hidden"
      style={{
        height: "calc(100vh - 56px)",
        background: "#f0f0f5",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div
        className="shrink-0"
        style={{
          background: "#f7f7fb",
          borderBottom: "1px solid #e8e8f0",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* ── MOBILE HEADER (< md) ── */}
        <div className="md:hidden">
          {/* Line 1: Title + filters + novo */}
          <div className="flex items-center gap-2" style={{ height: 46, padding: "0 12px" }}>
            <div className="h-6 w-6 rounded-md bg-[#4F46E5] flex items-center justify-center shrink-0">
              <LayoutGrid className="h-3 w-3 text-white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>Pipeline</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{filteredLeads.length}</span>
            <div className="flex-1" />

            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className="h-7 text-[10px] w-[100px] shrink-0"
                  style={{
                    borderRadius: 7, fontSize: 10, fontWeight: 600,
                    border: corretorFilter !== "all" ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                    background: corretorFilter !== "all" ? "#EFF6FF" : "#fff",
                    color: corretorFilter !== "all" ? "#1D4ED8" : "#64748B",
                  }}
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

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  background: "#4F46E5", color: "#fff", borderRadius: 7,
                  padding: "5px 10px", fontWeight: 700, fontSize: 12, border: "none",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                + Novo
              </button>
            )}
          </div>

          {/* Line 2 mobile: Status chips compact */}
          <div className="flex items-center gap-3 px-3 pb-2" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <button
              onClick={() => setClientStatusFilter(f => f === "em_dia" ? "todos" : "em_dia")}
              className="flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "none", border: "none", cursor: "pointer" }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#059669" }} />
              {clientStatusCounts.em_dia}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
              className="flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 600, color: "#D97706", background: "none", border: "none", cursor: "pointer" }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#D97706" }} />
              {clientStatusCounts.desatualizado}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
              className="flex items-center gap-1"
              style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#DC2626" }} />
              {clientStatusCounts.tarefa_atrasada}
            </button>
            <div className="flex-1" />
            {hasAnyFilter && (
              <button onClick={clearAllFilters} style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}>
                <X style={{ height: 10, width: 10 }} /> Limpar
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#64748B" }} />
            </button>
          </div>
        </div>

        {/* ── TABLET HEADER (md to lg) ── */}
        <div className="hidden md:block lg:hidden">
          <div className="flex items-center gap-2" style={{ height: 48, padding: "0 16px", borderBottom: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Pipeline</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{filteredLeads.length}</span>

            <div className="flex-1" />

            {/* Tab switcher - icons only */}
            <div className="flex items-center" style={{ background: "#F1F5F9", borderRadius: 7, padding: 2 }}>
              {[
                { key: "kanban", icon: <LayoutGrid style={{ height: 12, width: 12 }} />, label: "Kanban" },
                { key: "inteligencia", icon: <Brain style={{ height: 12, width: 12 }} />, label: "Intel" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  title={tab.label}
                  className="flex items-center gap-1"
                  style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: activeTab === tab.key ? "#fff" : "transparent",
                    boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.09)" : "none",
                    color: activeTab === tab.key ? "#1E293B" : "#64748B",
                    border: "none", cursor: "pointer",
                  }}
                >
                  {tab.icon}
                  <span className="hidden xl:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className="h-7 text-[10px] w-[110px] shrink-0"
                  style={{
                    borderRadius: 7, fontSize: 10, fontWeight: 600,
                    border: corretorFilter !== "all" ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                    background: corretorFilter !== "all" ? "#EFF6FF" : "#fff",
                    color: corretorFilter !== "all" ? "#1D4ED8" : "#64748B",
                  }}
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

            <div className="relative" style={{ width: 120 }}>
              <Search className="absolute top-1/2 -translate-y-1/2" style={{ left: 8, height: 12, width: 12, color: "#94A3B8" }} />
              <input
                placeholder="Buscar..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full outline-none"
                style={{
                  height: 30, borderRadius: 7, background: "#F8FAFC",
                  border: "1px solid #E2E8F0", paddingLeft: 26, paddingRight: 8,
                  fontSize: 11, fontWeight: 500,
                }}
              />
            </div>

            <button onClick={handleRefresh} disabled={refreshing} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#64748B" }} />
            </button>

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  background: "#2563EB", color: "#fff", borderRadius: 8,
                  padding: "6px 10px", fontWeight: 700, fontSize: 11, border: "none",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                + Novo Lead
              </button>
            )}
          </div>

          {/* Tablet line 2: status chips + fila ceo */}
          <div className="flex items-center gap-2 overflow-x-auto" style={{ height: 32, padding: "0 16px" }}>
            {/* Status chips */}
            {[
              { key: "em_dia" as const, label: "Em dia", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", count: clientStatusCounts.em_dia },
              { key: "desatualizado" as const, label: "Desatual.", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", count: clientStatusCounts.desatualizado },
              { key: "tarefa_atrasada" as const, label: "Atrasado", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", count: clientStatusCounts.tarefa_atrasada },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => setClientStatusFilter(f => f === chip.key ? "todos" : chip.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 700,
                  background: clientStatusFilter === chip.key ? chip.bg : "#fff",
                  color: chip.color,
                  border: clientStatusFilter === chip.key ? `1.5px solid ${chip.border}` : "1px solid #E2E8F0",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: chip.color }} />
                {chip.label} {chip.count > 0 && chip.count}
              </button>
            ))}

            {isAdmin && filaCeoCount > 0 && (
              <>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    padding: "2px 8px", borderRadius: 100, fontSize: 10, fontWeight: 700,
                    background: filaCeoFilter ? "#F5F3FF" : "#fff",
                    color: filaCeoFilter ? "#7C3AED" : "#94A3B8",
                    border: filaCeoFilter ? "1.5px solid #C4B5FD" : "1px solid #E2E8F0",
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  📥 CEO {filaCeoCount}
                </button>
                <button
                  onClick={() => setDispatchOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 3,
                    height: 20, padding: "0 6px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                    background: "#7C3AED", color: "#fff", border: "none", cursor: "pointer",
                  }}
                >
                  <Rocket style={{ height: 10, width: 10 }} /> Disparar
                </button>
              </>
            )}

            {isAdmin && activeTab === "kanban" && (
              <button
                onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
                style={{
                  height: 22, borderRadius: 6, padding: "0 8px",
                  border: selectionMode ? "1px solid #2563EB" : "1px solid #E2E8F0",
                  background: selectionMode ? "#EFF6FF" : "#fff",
                  color: selectionMode ? "#2563EB" : "#64748B",
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                {selectionMode ? <CheckSquare style={{ height: 10, width: 10 }} /> : <Square style={{ height: 10, width: 10 }} />}
                {selectionMode ? "Selec..." : "Selec."}
              </button>
            )}

            {hasAnyFilter && (
              <button onClick={clearAllFilters} style={{ fontSize: 9, fontWeight: 600, color: "#DC2626", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                <X style={{ height: 9, width: 9 }} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* ── DESKTOP HEADER (lg+) ── */}
        <div className="hidden lg:block">
          {/* Line 1 — Title + Filters + Search + Novo Lead */}
          <div
            className="flex items-center"
            style={{ height: 48, padding: "0 24px", borderBottom: "1px solid #e8e8f0", gap: 8 }}
          >
            {/* LEFT: Title */}
            <div className="flex items-center flex-shrink-0 gap-2 min-w-0">
              <div className="w-7 h-7 rounded-[7px] bg-[#4F46E5] flex items-center justify-center shrink-0">
                <LayoutGrid size={13} strokeWidth={1.5} className="text-white" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0a0a0a", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                Pipeline
              </span>
              <span className="text-[12px] text-[#a1a1aa] font-medium shrink-0">{filteredLeads.length} leads</span>
            </div>

            <div className="flex-1" />

            {/* CENTER-RIGHT: Filters inline */}
            <div className="flex items-center" style={{ gap: 6 }}>
              {(isAdmin || isGestor) && (
                <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                  <SelectTrigger
                    className="h-[32px] text-[12px] w-[170px] shrink-0"
                    style={{
                      borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: corretorFilter !== "all" ? "1px solid #4F46E5" : "1px solid #e8e8f0",
                      background: corretorFilter !== "all" ? "#4F46E5/5" : "#f7f7fb",
                      color: corretorFilter !== "all" ? "#4F46E5" : "#52525b",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
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
                    className="h-[32px] text-[12px] w-[160px] shrink-0"
                    style={{
                      borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: campaignTagFilter !== "all" ? "1px solid #4F46E5" : "1px solid #e8e8f0",
                      background: campaignTagFilter !== "all" ? "#4F46E5/5" : "#f7f7fb",
                      color: campaignTagFilter !== "all" ? "#4F46E5" : "#52525b",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
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
              <div className="relative" style={{ width: filters.search ? 200 : 160, transition: "width 0.2s ease" }}>
                <Search size={12} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
                <input
                  placeholder="Buscar..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="w-full outline-none"
                  style={{
                    height: 32, borderRadius: 8, background: "#f7f7fb",
                    border: "1px solid #e8e8f0", paddingLeft: 28, paddingRight: 8,
                    fontSize: 12, fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif",
                    transition: "all 0.2s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#4F46E5";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e8e8f0";
                  }}
                />
                {filters.search && (
                  <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3 w-3 text-[#a1a1aa]" />
                  </button>
                )}
              </div>

              {/* Modo Foco */}
              {isCorretor && activeTab === "kanban" && (
                <button
                  onClick={() => setFocusModeOpen(true)}
                  className="whitespace-nowrap flex items-center gap-1.5 transition-colors"
                  style={{
                    height: 32, padding: "0 12px",
                    background: "linear-gradient(135deg, #4F46E5, #7C3AED)", color: "#fff", borderRadius: 8,
                    fontWeight: 600, fontSize: 12, border: "none",
                    cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Zap size={13} strokeWidth={2} /> Modo Foco
                  {focusLeads.length > 0 && (
                    <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                      {focusLeads.length}
                    </span>
                  )}
                </button>
              )}

              {/* Novo Lead */}
              {canAdd && activeTab === "kanban" && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="whitespace-nowrap flex items-center gap-1.5 transition-colors"
                  style={{
                    height: 32, padding: "0 14px",
                    background: "#4F46E5", color: "#fff", borderRadius: 8,
                    fontWeight: 600, fontSize: 12, border: "none",
                    cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#4338CA"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#4F46E5"; }}
                >
                  <Plus size={13} strokeWidth={2} /> Novo Lead
                </button>
              )}
            </div>
          </div>

          {/* Line 2 — Views + actions + indicators — fixed 32px */}
          <div
            className="flex items-center overflow-x-auto"
            style={{ height: 32, padding: "0 24px", gap: 4 }}
          >
            {/* View switcher */}
            <button
              onClick={() => setActiveTab("kanban")}
              className="flex items-center gap-1.5 shrink-0 transition-colors"
              style={{
                height: 28, padding: "0 10px", borderRadius: 7,
                background: activeTab === "kanban" ? "#4F46E5" : "transparent",
                color: activeTab === "kanban" ? "#fff" : "#71717a",
                fontSize: 12, fontWeight: activeTab === "kanban" ? 600 : 500,
                border: "none", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <LayoutGrid size={12} strokeWidth={1.5} /> Kanban
            </button>
            <button
              onClick={() => setActiveTab("inteligencia")}
              className="flex items-center gap-1.5 shrink-0 transition-colors"
              style={{
                height: 28, padding: "0 10px", borderRadius: 7,
                background: activeTab === "inteligencia" ? "#4F46E5" : "transparent",
                color: activeTab === "inteligencia" ? "#fff" : "#71717a",
                fontSize: 12, fontWeight: activeTab === "inteligencia" ? 600 : 500,
                border: "none", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <Brain size={12} strokeWidth={1.5} /> Inteligência
            </button>

            {activeTab === "inteligencia" && (
              <div className="flex items-center" style={{ background: "#f0f0f5", borderRadius: 7, padding: 2, marginLeft: 2 }}>
                <button
                  onClick={() => setIntelView("funil")}
                  style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: intelView === "funil" ? "#fff" : "transparent",
                    color: intelView === "funil" ? "#0a0a0a" : "#71717a",
                    border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <BarChart3 className="h-3 w-3 inline mr-1" />Funil
                </button>
                <button
                  onClick={() => setIntelView("radar")}
                  style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: intelView === "radar" ? "#fff" : "transparent",
                    color: intelView === "radar" ? "#0a0a0a" : "#71717a",
                    border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Radar className="h-3 w-3 inline mr-1" />Radar
                </button>
              </div>
            )}

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0 flex items-center justify-center transition-colors"
              style={{
                width: 28, height: 28, borderRadius: 7,
                color: "#a1a1aa", background: "transparent",
                border: "none", cursor: "pointer",
              }}
            >
              <RefreshCw size={12} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
            </button>

            {isAdmin && activeTab === "kanban" && (
              <button
                onClick={() => { if (selectionMode) { clearSelection(); } else { setSelectionMode(true); } }}
                className="flex items-center gap-1.5 shrink-0 transition-colors"
                style={{
                  height: 28, padding: "0 10px", borderRadius: 7,
                  background: selectionMode ? "#4F46E5" : "transparent",
                  color: selectionMode ? "#fff" : "#71717a",
                  fontSize: 12, fontWeight: 500,
                  border: "none", cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {selectionMode ? <CheckSquare size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
                {selectionMode ? "Selecionando..." : "Selecionar"}
              </button>
            )}

            {/* Separator */}
            {isAdmin && filaCeoCount > 0 && (
              <>
                <div className="w-px h-4 bg-[#e8e8f0] mx-1 shrink-0" />
                <span style={{ fontSize: 11, color: "#a1a1aa", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Fila CEO</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}>{filaCeoCount}</span>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  className="shrink-0 flex items-center gap-1 transition-colors"
                  style={{
                    height: 22, padding: "0 6px", borderRadius: 6,
                    fontSize: 10, fontWeight: 700,
                    background: filaCeoFilter ? "#4F46E5/10" : "transparent",
                    color: filaCeoFilter ? "#4F46E5" : "#a1a1aa",
                    border: filaCeoFilter ? "1px solid #4F46E5" : "1px solid #e8e8f0",
                    cursor: "pointer",
                  }}
                >
                  {filaCeoFilter ? "Filtrando" : "Filtrar"}
                </button>
                <button
                  onClick={() => setDispatchOpen(true)}
                  className="shrink-0 flex items-center gap-1.5 transition-colors"
                  style={{
                    height: 28, padding: "0 10px", borderRadius: 7,
                    background: "#4F46E5", color: "#fff",
                    fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#4338CA"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#4F46E5"; }}
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
                className="flex items-center gap-1 transition-opacity"
                style={{
                  fontSize: 11, fontWeight: 600, color: "#10b981",
                  background: "none", border: "none", cursor: "pointer",
                  opacity: clientStatusFilter === "em_dia" ? 1 : 0.7,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                {clientStatusCounts.em_dia.toLocaleString("pt-BR")}
              </button>
              <button
                onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
                className="flex items-center gap-1 transition-opacity"
                style={{
                  fontSize: 11, fontWeight: 600, color: "#f59e0b",
                  background: "none", border: "none", cursor: "pointer",
                  opacity: clientStatusFilter === "desatualizado" ? 1 : 0.7,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                {clientStatusCounts.desatualizado.toLocaleString("pt-BR")}
              </button>
              <button
                onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
                className="flex items-center gap-1 transition-opacity"
                style={{
                  fontSize: 11, fontWeight: 600, color: "#ef4444",
                  background: "none", border: "none", cursor: "pointer",
                  opacity: clientStatusFilter === "tarefa_atrasada" ? 1 : 0.7,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                {clientStatusCounts.tarefa_atrasada.toLocaleString("pt-BR")}
              </button>
            </div>

            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="shrink-0 flex items-center gap-1"
                style={{
                  fontSize: 10, fontWeight: 600, color: "#ef4444",
                  background: "none", border: "none", cursor: "pointer",
                }}
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
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3"
          style={{
            padding: "12px 20px", borderRadius: 14, background: "#fff",
            border: "1px solid #E2E8F0",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
            {selectedLeads.size} selecionado{selectedLeads.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setBulkActionOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#2563EB", color: "#fff", borderRadius: 10,
              padding: "8px 16px", fontWeight: 700, fontSize: 12, border: "none",
              cursor: "pointer",
            }}
          >
            <Send style={{ height: 14, width: 14 }} /> Ações em Massa
          </button>
          <button
            onClick={clearSelection}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "none", color: "#DC2626", border: "none",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}
          >
            <X style={{ height: 14, width: 14 }} /> Cancelar
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
