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
import { CheckSquare, Square, Send, X } from "lucide-react";
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
import { getCardStatus } from "@/components/pipeline/CardStatusLine";

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

type ClientStatusFilter = "todos" | "em_dia" | "desatualizado" | "tarefa_atrasada";

function classifyLeadStatus(lead: PipelineLead, proximaTarefa: any): ClientStatusFilter {
  const tarefa = proximaTarefa || (
    (lead as any).data_proxima_acao
      ? { tipo: (lead as any).proxima_acao || "follow_up", vence_em: (lead as any).data_proxima_acao, hora_vencimento: null }
      : null
  );
  const status = getCardStatus(lead, tarefa);
  if (status.indicator === "🔴") return "tarefa_atrasada";
  if (status.indicator === "✅" || !status.text) return "em_dia";
  return "desatualizado";
}

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
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });

  const canAdd = isGestor || isAdmin || isCorretor;

  const filteredLeads = useMemo(() => {
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
    if (clientStatusFilter !== "todos") {
      result = result.filter(l => classifyLeadStatus(l, kanbanTarefasMap[l.id] || null) === clientStatusFilter);
    }
    return result;
  }, [pipeline.leads, filters, pipeline.stages, filaCeoFilter, corretorFilter, campaignTagFilter, clientStatusFilter, kanbanTarefasMap]);

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

  // Client status counts
  const clientStatusCounts = useMemo(() => {
    const counts = { em_dia: 0, desatualizado: 0, tarefa_atrasada: 0 };
    for (const l of pipeline.leads) {
      const s = classifyLeadStatus(l, kanbanTarefasMap[l.id] || null);
      if (s !== "todos") counts[s]++;
    }
    return counts;
  }, [pipeline.leads, kanbanTarefasMap]);

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
        background: "#ECF0F6",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ═══ HEADER — 2 lines, sticky, clean ═══ */}
      <div
        className="shrink-0"
        style={{
          background: "#fff",
          borderBottom: "1px solid #E2E8F0",
          boxShadow: "0 1px 0 #F1F5F9, 0 4px 16px rgba(0,0,0,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Line 1 — Title + Filters + Search + Novo Lead */}
        <div
          className="flex items-center md:!px-[28px]"
          style={{ height: 52, padding: "0 14px", borderBottom: "1px solid #E2E8F0", gap: 10 }}
        >
          {/* LEFT: Title */}
          <div className="flex items-center flex-shrink-0 gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <LayoutGrid className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="whitespace-nowrap" style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", letterSpacing: "-0.3px" }}>
              <span className="md:hidden">Pipeline</span>
              <span className="hidden md:inline">Pipeline de Leads</span>
            </span>
            <span className="text-[13px] text-[#94a3b8] font-medium">{filteredLeads.length} leads</span>
          </div>

          {/* CENTER: Corretor + Campaign + Filters */}
          <div className="hidden md:flex items-center flex-1 min-w-0 justify-center" style={{ gap: 6 }}>
            {(isAdmin || isGestor) && (
              <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                <SelectTrigger
                  className="h-8 text-[11px] w-[170px] shrink-0"
                  style={{
                    borderRadius: 8, fontSize: 11, fontWeight: 600,
                    border: corretorFilter !== "all" ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                    background: corretorFilter !== "all" ? "#EFF6FF" : "#fff",
                    color: corretorFilter !== "all" ? "#1D4ED8" : "#64748B",
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
                  className="h-8 text-[11px] w-[160px] shrink-0"
                  style={{
                    borderRadius: 8, fontSize: 11, fontWeight: 600,
                    border: campaignTagFilter !== "all" ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                    background: campaignTagFilter !== "all" ? "#EFF6FF" : "#fff",
                    color: campaignTagFilter !== "all" ? "#1D4ED8" : "#64748B",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <SelectValue placeholder="🏷️ Campanha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏷️ Todas as campanhas</SelectItem>
                  {CAMPAIGN_TAGS.filter(ct => campaignTagCounts[ct.tag]).map(ct => (
                    <SelectItem key={ct.tag} value={ct.tag}>
                      {ct.label} ({campaignTagCounts[ct.tag]})
                    </SelectItem>
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
          </div>

          {/* RIGHT: Search + Novo Lead + Avatar */}
          <div className="flex items-center flex-shrink-0 ml-auto" style={{ gap: 8 }}>
            <div className="relative" style={{ width: filters.search ? 232 : 192, transition: "width 0.2s ease", maxWidth: "40vw" }}>
              <Search className="absolute top-1/2 -translate-y-1/2" style={{ left: 10, height: 14, width: 14, color: "#94A3B8" }} />
              <input
                placeholder="Buscar..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full outline-none"
                style={{
                  height: 36, borderRadius: 10, background: "#F8FAFC",
                  border: "1px solid #E2E8F0", paddingLeft: 32, paddingRight: 10,
                  fontSize: 13, fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#BFDBFE";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.09)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {filters.search && (
                <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3" style={{ color: "#94A3B8" }} />
                </button>
              )}
            </div>

            {canAdd && activeTab === "kanban" && (
              <button
                onClick={() => setAddOpen(true)}
                className="whitespace-nowrap"
                style={{
                  background: "#2563EB", color: "#fff", borderRadius: 10,
                  padding: "8px 14px", fontWeight: 700, fontSize: 12, border: "none",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.28)", cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1D4ED8";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2563EB";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.28)";
                }}
              >
                <span className="hidden sm:inline">＋ Novo Lead</span>
                <span className="sm:hidden">＋</span>
              </button>
            )}

            <div
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #E2E8F0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}
            >
              {authUser?.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>

        {/* Line 2 — 44px — hidden on mobile when kanban */}
        <div
          className={`flex items-center justify-between overflow-x-auto ${isMobile && activeTab === "kanban" ? "hidden" : ""}`}
          style={{ minHeight: 44, padding: "0 14px", gap: 6 }}
        >
          {/* LEFT: Segmented control + filters */}
          <div className="flex items-center flex-shrink-0" style={{ gap: 6 }}>
            {/* Segmented Control */}
            <div
              className="flex items-center"
              style={{ background: "#F1F5F9", borderRadius: 9, padding: 3 }}
            >
              {[
                { key: "kanban", label: "Kanban", icon: <LayoutGrid style={{ height: 12, width: 12 }} /> },
                { key: "inteligencia", label: "Inteligência", icon: <Brain style={{ height: 12, width: 12 }} /> },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: "4px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: activeTab === tab.key ? "#fff" : "transparent",
                    boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.09)" : "none",
                    color: activeTab === tab.key ? "#1E293B" : "#64748B",
                    border: "none", cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.25,0.46,0.45,0.94)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "inteligencia" && (
              <div className="flex items-center" style={{ background: "#F1F5F9", borderRadius: 9, padding: 3, marginLeft: 4 }}>
                <button
                  onClick={() => setIntelView("funil")}
                  style={{
                    padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: intelView === "funil" ? "#fff" : "transparent",
                    boxShadow: intelView === "funil" ? "0 1px 3px rgba(0,0,0,0.09)" : "none",
                    color: intelView === "funil" ? "#1E293B" : "#64748B",
                    border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <BarChart3 className="h-3 w-3 inline mr-1" />Funil
                </button>
                <button
                  onClick={() => setIntelView("radar")}
                  style={{
                    padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: intelView === "radar" ? "#fff" : "transparent",
                    boxShadow: intelView === "radar" ? "0 1px 3px rgba(0,0,0,0.09)" : "none",
                    color: intelView === "radar" ? "#1E293B" : "#64748B",
                    border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Radar className="h-3 w-3 inline mr-1" />Radar
                </button>
              </div>
            )}

            {/* Mobile-only filters (hidden on desktop since they're in Line 1) */}
            <div className="flex md:hidden items-center" style={{ gap: 6 }}>
              {(isAdmin || isGestor) && (
                <Select value={corretorFilter} onValueChange={setCorretorFilter}>
                  <SelectTrigger
                    className="h-7 text-[11px] w-[140px] shrink-0"
                    style={{
                      borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: corretorFilter !== "all" ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
                      background: corretorFilter !== "all" ? "#EFF6FF" : "#fff",
                      color: corretorFilter !== "all" ? "#1D4ED8" : "#64748B",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    <SelectValue placeholder="Corretores" />
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
              <PipelineAdvancedFilters
                filters={filters}
                onChange={setFilters}
                stages={pipeline.stages}
                segmentos={pipeline.segmentos}
                leads={pipeline.leads}
                corretorNomes={pipeline.corretorNomes}
                isManager={isGestor || isAdmin}
              />
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                width: 30, height: 30, borderRadius: 8,
                border: "1px solid #E2E8F0", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#64748B" }} />
            </button>

            {isAdmin && activeTab === "kanban" && (
              <button
                onClick={() => {
                  if (selectionMode) { clearSelection(); } else { setSelectionMode(true); }
                }}
                style={{
                  height: 30, borderRadius: 8, padding: "0 10px",
                  border: selectionMode ? "1px solid #2563EB" : "1px solid #E2E8F0",
                  background: selectionMode ? "#EFF6FF" : "#fff",
                  color: selectionMode ? "#2563EB" : "#64748B",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {selectionMode ? <CheckSquare style={{ height: 12, width: 12 }} /> : <Square style={{ height: 12, width: 12 }} />}
                <span className="hidden sm:inline">{selectionMode ? "Selecionando..." : "Selecionar"}</span>
              </button>
            )}
          </div>

          {/* RIGHT: Lead count + status chips */}
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
              {hasAnyFilter
                ? `${filteredLeads.length}/${pipeline.leads.length}`
                : filteredLeads.length.toLocaleString("pt-BR")} leads
            </span>

            {/* Fila CEO */}
            {isAdmin && filaCeoCount > 0 && (
              <>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                    background: filaCeoFilter ? "#F5F3FF" : "#fff",
                    color: filaCeoFilter ? "#7C3AED" : "#94A3B8",
                    border: filaCeoFilter ? "1.5px solid #C4B5FD" : "1px solid #E2E8F0",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  📥 Fila CEO <span style={{ fontWeight: 800 }}>{filaCeoCount}</span>
                </button>
                <button
                  onClick={() => setDispatchOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    height: 24, padding: "0 8px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: "#7C3AED", color: "#fff", border: "none", cursor: "pointer",
                  }}
                >
                  <Rocket style={{ height: 12, width: 12 }} /> Disparar
                </button>
              </>
            )}

            {/* Status chips */}
            <button
              onClick={() => setClientStatusFilter(f => f === "em_dia" ? "todos" : "em_dia")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                background: clientStatusFilter === "em_dia" ? "#ECFDF5" : "#fff",
                color: "#059669",
                border: clientStatusFilter === "em_dia" ? "1.5px solid #A7F3D0" : "1px solid #E2E8F0",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.95)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669" }} />
              Em dia {clientStatusCounts.em_dia > 0 && clientStatusCounts.em_dia}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                background: clientStatusFilter === "desatualizado" ? "#FFFBEB" : "#fff",
                color: "#D97706",
                border: clientStatusFilter === "desatualizado" ? "1.5px solid #FDE68A" : "1px solid #E2E8F0",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.95)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
            >
              Desatualizado {clientStatusCounts.desatualizado > 0 && clientStatusCounts.desatualizado}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700,
                background: clientStatusFilter === "tarefa_atrasada" ? "#FEF2F2" : "#fff",
                color: "#DC2626",
                border: clientStatusFilter === "tarefa_atrasada" ? "1.5px solid #FECACA" : "1px solid #E2E8F0",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(0.95)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
            >
              Atrasado {clientStatusCounts.tarefa_atrasada > 0 && clientStatusCounts.tarefa_atrasada}
            </button>

            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                style={{
                  fontSize: 10, fontWeight: 600, color: "#DC2626",
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 2,
                }}
              >
                <X style={{ height: 10, width: 10 }} /> Limpar
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
    </div>
    </ErrorBoundary>
  );
}
