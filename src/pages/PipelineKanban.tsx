import { useState, useMemo, useCallback, lazy, Suspense, useEffect } from "react";
import { LoadingState, ErrorState } from "@/components/ui/screen-states";
import PeriodBadge from "@/components/PeriodBadge";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // Build proximaTarefa from lead's own fields if not provided
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
  const pipeline = usePipeline();
  const { isGestor, isAdmin, isCorretor } = useUserRole();
  const { user: authUser } = useAuth();
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
      result = result.filter(l => classifyLeadStatus(l, null) === clientStatusFilter);
    }
    return result;
  }, [pipeline.leads, filters, pipeline.stages, filaCeoFilter, corretorFilter, campaignTagFilter, clientStatusFilter]);

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
      const s = classifyLeadStatus(l, null);
      if (s !== "todos") counts[s]++;
    }
    return counts;
  }, [pipeline.leads]);

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
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Controls — fixed top area */}
      <div className="shrink-0 space-y-1.5 pb-1.5">
        {/* Top bar: tabs + search + corretor + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="kanban" className="text-xs gap-1.5 px-3">
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="inteligencia" className="text-xs gap-1.5 px-3">
                <Brain className="h-3.5 w-3.5" />
                Inteligência
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <PeriodBadge className="text-[10px] shrink-0" />

          {activeTab === "inteligencia" && (
            <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
              <button
                onClick={() => setIntelView("funil")}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${intelView === "funil" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BarChart3 className="h-3 w-3 inline mr-1" />Funil
              </button>
              <button
                onClick={() => setIntelView("radar")}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${intelView === "radar" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Radar className="h-3 w-3 inline mr-1" />Radar
              </button>
            </div>
          )}

          <div className="relative flex-1 min-w-[120px] sm:min-w-[180px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-8 h-8 text-xs bg-card"
            />
            {filters.search && (
              <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <PipelineAdvancedFilters
            filters={filters}
            onChange={setFilters}
            stages={pipeline.stages}
            segmentos={pipeline.segmentos}
            leads={pipeline.leads}
            corretorNomes={pipeline.corretorNomes}
            isManager={isGestor || isAdmin}
          />

          {/* Corretor filter */}
          {(isAdmin || isGestor) && (
            <Select value={corretorFilter} onValueChange={setCorretorFilter}>
              <SelectTrigger className="h-8 text-xs w-[160px] sm:w-[200px] bg-card shrink-0">
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

          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {canAdd && activeTab === "kanban" && (
            <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1 h-8 text-[11px]">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo Lead</span>
            </Button>
          )}

          {isAdmin && activeTab === "kanban" && (
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="sm"
              className={`gap-1 h-8 text-[11px] ${selectionMode ? "bg-primary" : ""}`}
              onClick={() => {
                if (selectionMode) { clearSelection(); } else { setSelectionMode(true); }
              }}
            >
              {selectionMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{selectionMode ? "Selecionando..." : "Selecionar"}</span>
            </Button>
          )}
        </div>

        {/* Filter bar: count + quick filters */}
        <div className="flex items-center gap-2 flex-wrap px-0.5" style={{ minHeight: 28 }}>
          <span className="text-xs font-bold text-foreground shrink-0">
            {hasAnyFilter
              ? `${filteredLeads.length}/${pipeline.leads.length}`
              : `${filteredLeads.length}`} oportunidades
          </span>

          {/* Fila CEO */}
          {isAdmin && filaCeoCount > 0 && (
            <>
              <button
                onClick={() => setFilaCeoFilter(f => !f)}
                className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  filaCeoFilter
                    ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700"
                    : "bg-card text-muted-foreground border-border hover:border-purple-300 hover:text-purple-600"
                }`}
              >
                📥 Fila CEO
                <Badge className="text-[9px] px-1 py-0 h-3.5 bg-purple-600 text-white border-none">
                  {filaCeoCount}
                </Badge>
              </button>
              <Button
                size="sm"
                onClick={() => setDispatchOpen(true)}
                className="gap-1 h-6 text-[10px] px-2 bg-purple-600 hover:bg-purple-700 text-white border-none"
              >
                <Rocket className="h-3 w-3" />
                Disparar
              </Button>
            </>
          )}

          {/* Divider */}
          <div className="w-px h-4 bg-border shrink-0" />

          {/* Campaign tag filter */}
          {Object.keys(campaignTagCounts).length > 0 && (
            <Select value={campaignTagFilter} onValueChange={setCampaignTagFilter}>
              <SelectTrigger className={`h-7 text-[10px] w-[180px] shrink-0 rounded-full border ${
                campaignTagFilter !== "all" 
                  ? "bg-primary/10 border-primary/30 text-primary font-medium" 
                  : "bg-card text-muted-foreground"
              }`}>
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

          {/* Client status filter */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setClientStatusFilter(f => f === "em_dia" ? "todos" : "em_dia")}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                clientStatusFilter === "em_dia"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700"
                  : "bg-card text-muted-foreground border-border hover:border-emerald-300 hover:text-emerald-600"
              }`}
            >
              ✅ Em dia {clientStatusCounts.em_dia > 0 && <span className="opacity-70">({clientStatusCounts.em_dia})</span>}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "desatualizado" ? "todos" : "desatualizado")}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                clientStatusFilter === "desatualizado"
                  ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
                  : "bg-card text-muted-foreground border-border hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              🟡 Desatualizado {clientStatusCounts.desatualizado > 0 && <span className="opacity-70">({clientStatusCounts.desatualizado})</span>}
            </button>
            <button
              onClick={() => setClientStatusFilter(f => f === "tarefa_atrasada" ? "todos" : "tarefa_atrasada")}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                clientStatusFilter === "tarefa_atrasada"
                  ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700"
                  : "bg-card text-muted-foreground border-border hover:border-red-300 hover:text-red-600"
              }`}
            >
              🔴 Atrasado {clientStatusCounts.tarefa_atrasada > 0 && <span className="opacity-70">({clientStatusCounts.tarefa_atrasada})</span>}
            </button>
          </div>

          {/* Active filter badges */}
          {hasAnyFilter && (
            <div className="flex items-center gap-1 ml-auto flex-wrap">
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
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-[10px] h-5 text-destructive gap-0.5 px-1.5">
                <X className="h-2.5 w-2.5" /> Limpar
              </Button>
            </div>
          )}
        </div>

        {/* Manager actions (no CEO Intelligence panel) */}
        {activeTab === "kanban" && isGestor && !isAdmin && (
          <PipelineManagerActions
            leads={pipeline.leads}
            corretorNomes={pipeline.corretorNomes}
          />
        )}

        {/* Melnick Campaign Analytics — shown when filter is active */}
        {campaignTagFilter === "MELNICK_DAY" && (
          <Suspense fallback={null}>
            <MelnickCampaignAnalytics />
          </Suspense>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          <ErrorBoundary onError={(err) => console.error("[PipelineBoard] Render crash:", err.message, err.stack)}>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
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

      {/* Floating selection toolbar */}
      {selectionMode && selectedLeads.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border shadow-2xl">
          <span className="text-sm font-bold text-foreground">
            {selectedLeads.size} selecionado{selectedLeads.size !== 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setBulkActionOpen(true)}
          >
            <Send className="h-3.5 w-3.5" />
            Ações em Massa
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
