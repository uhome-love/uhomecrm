import { useState, useMemo, useCallback, useEffect } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import PipelineFlowDashboard from "@/components/pipeline/PipelineFlowDashboard";
import MaterialsLibrary from "@/components/pipeline/MaterialsLibrary";
import SequenceBuilder from "@/components/pipeline/SequenceBuilder";
import SequenceLibrary from "@/components/pipeline/SequenceLibrary";
import OpportunityRadar from "@/components/pipeline/OpportunityRadar";
import PipelinePrioridades from "@/components/pipeline/PipelinePrioridades";
import PipelineReportsDashboard from "@/components/pipeline/PipelineReportsDashboard";
import ForecastPonderadoPanel from "@/components/pipeline/ForecastPonderadoPanel";
import PipelineAdvancedFilters, {
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  type PipelineFilters,
} from "@/components/pipeline/PipelineAdvancedFilters";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, X, CloudDownload, BarChart3, FolderOpen, Zap, Radar, FileText } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PRIORIDADES_KEY = "uhome-prioridades-open";

export default function PipelineKanban() {
  const pipeline = usePipeline();
  const { isGestor, isAdmin } = useUserRole();
  const { user: authUser } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({ ...EMPTY_FILTERS });
  const [parcerias, setParcerias] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState("kanban");
  const [prioridadesOpen, setPrioridadesOpen] = useState(() => {
    try { return localStorage.getItem(PRIORIDADES_KEY) !== "false"; } catch { return true; }
  });

  const togglePrioridades = useCallback(() => {
    setPrioridadesOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(PRIORIDADES_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // Load partnerships
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pipeline_parcerias")
        .select("pipeline_lead_id, corretor_parceiro_id")
        .eq("status", "ativa");
      if (!data || data.length === 0) return;
      const parceiroIds = [...new Set(data.map(p => p.corretor_parceiro_id))];
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, nome")
        .in("user_id", parceiroIds);
      const nameMap: Record<string, string> = {};
      members?.forEach(m => { if (m.user_id) nameMap[m.user_id] = m.nome; });
      const result: Record<string, string> = {};
      data.forEach(p => { result[p.pipeline_lead_id] = nameMap[p.corretor_parceiro_id] || "Parceiro"; });
      setParcerias(result);
    })();
  }, [pipeline.leads]);

  const canAdd = isGestor || isAdmin;

  const filteredLeads = useMemo(() =>
    applyFilters(pipeline.leads, filters, pipeline.stages),
    [pipeline.leads, filters, pipeline.stages]
  );

  const totalVGV = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [filteredLeads]
  );

  const activeFiltersCount = countActiveFilters(filters);

  const formatVGV = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
    if (value >= 1_000) return `R$ ${value.toLocaleString("pt-BR")}`;
    return `R$ ${value}`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await pipeline.reload();
    setRefreshing(false);
  };

  const handleJetimobSync = useCallback(async () => {
    if (!authUser) return;
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("jetimob-sync", {
        body: {},
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.synced > 0) {
        toast.success(`${data.synced} leads sincronizados do Jetimob para o Pipeline!`);
        await pipeline.reload();
      } else {
        toast.info(`Nenhum lead novo. ${data?.skipped || 0} já existiam no Pipeline.`);
      }
    } catch (err) {
      console.error("Jetimob sync error:", err);
      toast.error("Erro ao sincronizar leads do Jetimob.");
    } finally {
      setSyncing(false);
    }
  }, [authUser, pipeline]);

  const clearFilters = () => setFilters({ ...EMPTY_FILTERS });

  if (pipeline.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando pipeline...</span>
      </div>
    );
  }

  const isKanbanOrFlow = activeTab === "kanban" || activeTab === "flow";

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Controls — fixed top area */}
      <div className="shrink-0 space-y-3 pb-3">
        {/* Top bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="kanban" className="text-xs gap-1.5 px-2 sm:px-3">
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="flow" className="text-xs gap-1.5 px-2 sm:px-3">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fluxo</span>
              </TabsTrigger>
              {canAdd && (
                <>
                  <TabsTrigger value="materiais" className="text-xs gap-1.5 px-2 sm:px-3">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Materiais</span>
                  </TabsTrigger>
                  <TabsTrigger value="sequencias" className="text-xs gap-1.5 px-2 sm:px-3">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sequências</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="radar" className="text-xs gap-1.5 px-2 sm:px-3">
                <Radar className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Radar</span>
              </TabsTrigger>
              <TabsTrigger value="relatorios" className="text-xs gap-1.5 px-2 sm:px-3">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isKanbanOrFlow && (
            <>
              <div className="relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, telefone, email..."
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  className="pl-9 h-9 bg-card"
                />
                {filters.search && (
                  <button onClick={() => setFilters(f => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
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
            </>
          )}

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {canAdd && activeTab === "kanban" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleJetimobSync}
                disabled={syncing}
                className="gap-1.5 h-9 hidden sm:flex"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                {syncing ? "Sincronizando..." : "Sync Jetimob"}
              </Button>
              <Button variant="outline" size="icon" onClick={handleJetimobSync} disabled={syncing} className="h-9 w-9 sm:hidden shrink-0">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              </Button>
              <Button onClick={() => setAddOpen(true)} size="icon" className="h-9 w-9 sm:hidden shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
              <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9 hidden sm:flex">
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            </>
          )}
        </div>

        {/* Active filter chips + summary */}
        {isKanbanOrFlow && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {activeFiltersCount > 0
                  ? `${filteredLeads.length} de ${pipeline.leads.length} leads`
                  : `${filteredLeads.length} oportunidades`}
              </span>
            </div>
            {totalVGV > 0 && (
              <span className="text-sm text-muted-foreground font-medium">
                • {formatVGV(totalVGV)} em VGV
              </span>
            )}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {filters.temperaturas.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, temperaturas: [] }))}>
                    Temp: {filters.temperaturas.join(", ")} ×
                  </Badge>
                )}
                {filters.scoreMin > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, scoreMin: 0 }))}>
                    Score ≥{filters.scoreMin} ×
                  </Badge>
                )}
                {filters.stages.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, stages: [] }))}>
                    {filters.stages.length} etapas ×
                  </Badge>
                )}
                {filters.origens.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, origens: [] }))}>
                    {filters.origens.length} origens ×
                  </Badge>
                )}
                {filters.segmentos.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, segmentos: [] }))}>
                    {filters.segmentos.length} segmentos ×
                  </Badge>
                )}
                {filters.diasSemAcao && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, diasSemAcao: "" }))}>
                    &gt;{filters.diasSemAcao}d parado ×
                  </Badge>
                )}
                {filters.periodoEntrada && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, periodoEntrada: "" }))}>
                    Período ×
                  </Badge>
                )}
                {filters.slaStatus && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, slaStatus: "" }))}>
                    SLA: {filters.slaStatus} ×
                  </Badge>
                )}
                {filters.comVisita && (
                  <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilters(f => ({ ...f, comVisita: "" }))}>
                    Visita: {filters.comVisita} ×
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 text-destructive gap-1">
                  <X className="h-3 w-3" /> Limpar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Forecast Ponderado */}
        {activeTab === "kanban" && (
          <ForecastPonderadoPanel leads={filteredLeads} stages={pipeline.stages} />
        )}
      </div>

      {/* Content area — kanban + side panel */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          {activeTab === "kanban" ? (
            <PipelineBoard
              stages={pipeline.stages}
              leads={filteredLeads}
              segmentos={pipeline.segmentos}
              corretorNomes={pipeline.corretorNomes}
              parcerias={parcerias}
              onMoveLead={pipeline.moveLead}
              onSelectLead={setSelectedLead}
              onTransferred={() => pipeline.reload()}
            />
          ) : activeTab === "flow" ? (
            <PipelineFlowDashboard
              stages={pipeline.stages}
              leads={filteredLeads}
              corretorNomes={pipeline.corretorNomes}
            />
          ) : activeTab === "materiais" ? (
            <div className="h-full overflow-auto p-1">
              <MaterialsLibrary />
            </div>
          ) : activeTab === "sequencias" ? (
            <div className="h-full overflow-auto p-1 space-y-6">
              <SequenceLibrary onSequenceCreated={() => pipeline.reload()} />
              <SequenceBuilder />
            </div>
          ) : activeTab === "radar" ? (
            <OpportunityRadar
              leads={pipeline.leads}
              stages={pipeline.stages}
              corretorNomes={pipeline.corretorNomes}
              onSelectLead={setSelectedLead}
            />
          ) : activeTab === "relatorios" ? (
            <PipelineReportsDashboard
              stages={pipeline.stages}
              leads={pipeline.leads}
              corretorNomes={pipeline.corretorNomes}
            />
          ) : null}
        </div>

        {/* Right side panel — Prioridades */}
        {activeTab === "kanban" && (
          <PipelinePrioridades
            leads={filteredLeads}
            stages={pipeline.stages}
            corretorNomes={pipeline.corretorNomes}
            onSelectLead={setSelectedLead}
            open={prioridadesOpen}
            onToggle={togglePrioridades}
          />
        )}
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
          onOpenChange={(open) => !open && setSelectedLead(null)}
          onUpdate={pipeline.updateLead}
          onMove={pipeline.moveLead}
          onDelete={pipeline.deleteLead}
        />
      )}
    </div>
  );
}
