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
import PipelineCeoIntelligence from "@/components/pipeline/PipelineCeoIntelligence";
import PipelineManagerActions from "@/components/pipeline/PipelineManagerActions";

import PipelineReportsDashboard from "@/components/pipeline/PipelineReportsDashboard";
import type { PipelineStage } from "@/hooks/usePipeline";
import { useMemo as useMemoReact } from "react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp, CheckSquare, Square, Send, X } from "lucide-react";
import PipelineAdvancedFilters, {
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  type PipelineFilters,
} from "@/components/pipeline/PipelineAdvancedFilters";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, BarChart3, FolderOpen, Zap, Radar, FileText, Brain, Rocket } from "lucide-react";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkActionModal from "@/components/pipeline/BulkActionModal";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";



// ─── Forecast Probability Map ───
const STAGE_PROBABILITY: Record<string, number> = {
  novo: 10, atendimento: 15, qualificacao: 25, visita_marcada: 40,
  visita_realizada: 60, negociacao: 75, proposta: 85, assinatura: 95,
};
const EXCLUDED_TYPES = ["venda", "descarte", "caiu"];

function ForecastInline({ leads, stages, expanded, onToggle }: {
  leads: PipelineLead[]; stages: PipelineStage[]; expanded: boolean; onToggle: () => void;
}) {
  const forecast = useMemoReact(() => {
    const stageMap = new Map(stages.map(s => [s.id, s]));
    const activeLeads = leads.filter(l => { const s = stageMap.get(l.stage_id); return s && !EXCLUDED_TYPES.includes(s.tipo); });
    let conserv = 0, prov = 0, otim = 0;
    for (const lead of activeLeads) {
      const s = stageMap.get(lead.stage_id)!;
      const vgv = lead.valor_estimado || 0;
      const prob = STAGE_PROBABILITY[s.tipo] ?? 20;
      otim += vgv;
      prov += vgv * (prob / 100);
      if (prob >= 75) conserv += vgv;
    }
    return { conserv, prov: Math.round(prov), otim };
  }, [leads, stages]);

  const fmt = (v: number) => {
    if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
    return `R$${v}`;
  };

  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
    >
      <span>💰</span>
      <span className="text-blue-600 font-medium">{fmt(forecast.conserv)}</span>
      <span>·</span>
      <span className="text-amber-600 font-medium">{fmt(forecast.prov)}</span>
      <span>·</span>
      <span className="text-emerald-600 font-medium">{fmt(forecast.otim)}</span>
      {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
    </button>
  );
}

export default function PipelineKanban() {
  const pipeline = usePipeline();
  const { isGestor, isAdmin, isCorretor } = useUserRole();
  const { user: authUser } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filters, setFilters] = useState<PipelineFilters>({ ...EMPTY_FILTERS });
  const [parcerias, setParcerias] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("kanban");
  const [filaCeoFilter, setFilaCeoFilter] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [forecastExpanded, setForecastExpanded] = useState(false);
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLeads(new Set());
    setSelectionMode(false);
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

  const filteredLeads = useMemo(() => {
    let result = applyFilters(pipeline.leads, filters, pipeline.stages);
    if (filaCeoFilter) {
      result = result.filter(l => !l.corretor_id);
    }
    return result;
  }, [pipeline.leads, filters, pipeline.stages, filaCeoFilter]);

  const filaCeoCount = useMemo(() =>
    pipeline.leads.filter(l => !l.corretor_id || l.corretor_id === "").length,
    [pipeline.leads]
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


  const [intelView, setIntelView] = useState<"funil" | "radar">("funil");
  const [autoView, setAutoView] = useState<"materiais" | "sequencias">("materiais");

  const clearFilters = () => setFilters({ ...EMPTY_FILTERS });

  if (pipeline.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando pipeline...</span>
      </div>
    );
  }

  const isKanbanOrIntel = activeTab === "kanban" || activeTab === "inteligencia";

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Controls — fixed top area */}
      <div className="shrink-0 space-y-1 pb-1">
        {/* Top bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="kanban" className="text-[11px] gap-1 px-2">
                <LayoutGrid className="h-3 w-3" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="inteligencia" className="text-[11px] gap-1 px-2">
                <Brain className="h-3 w-3" />
                <span className="hidden sm:inline">Inteligência</span>
              </TabsTrigger>
              {canAdd && (
                <TabsTrigger value="automacoes" className="text-[11px] gap-1 px-2">
                  <Zap className="h-3 w-3" />
                  <span className="hidden sm:inline">Automações</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="relatorios" className="text-[11px] gap-1 px-2">
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline">Relatórios</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {isKanbanOrIntel && (
            <>
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
            </>
          )}

          {activeTab === "automacoes" && (
            <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
              <button
                onClick={() => setAutoView("materiais")}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${autoView === "materiais" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <FolderOpen className="h-3 w-3 inline mr-1" />Materiais
              </button>
              <button
                onClick={() => setAutoView("sequencias")}
                className={`text-[11px] px-2 py-0.5 rounded transition-colors ${autoView === "sequencias" ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Zap className="h-3 w-3 inline mr-1" />Sequências
              </button>
            </div>
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

        {/* Summary line + Forecast inline */}
        {isKanbanOrIntel && (
          <div className="flex items-center gap-2 flex-wrap px-0.5" style={{ minHeight: 28 }}>
            <span className="text-[11px] font-bold text-foreground">
              {activeFiltersCount > 0
                ? `${filteredLeads.length}/${pipeline.leads.length}`
                : `${filteredLeads.length}`} oportunidades
              {isAdmin && filaCeoCount > 0 && !filaCeoFilter && (
                <span className="text-purple-600 dark:text-purple-400 font-normal"> ({filaCeoCount} sem corretor)</span>
              )}
            </span>

            {isAdmin && filaCeoCount > 0 && (
              <>
                <button
                  onClick={() => setFilaCeoFilter(f => !f)}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                    filaCeoFilter
                      ? "bg-purple-100 text-purple-700 border-purple-300"
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

            {totalVGV > 0 && (
              <span className="text-[11px] text-muted-foreground">• {formatVGV(totalVGV)} VGV</span>
            )}

            {/* Inline Forecast */}
            {activeTab === "kanban" && (
              <ForecastInline leads={filteredLeads} stages={pipeline.stages} expanded={forecastExpanded} onToggle={() => setForecastExpanded(e => !e)} />
            )}

            {activeFiltersCount > 0 && (
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
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[10px] h-5 text-destructive gap-0.5 px-1.5">
                  <X className="h-2.5 w-2.5" /> Limpar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Role-based action panels */}
        {isKanbanOrIntel && activeTab === "kanban" && isAdmin && (
          <PipelineCeoIntelligence
            leads={pipeline.leads}
            stages={pipeline.stages}
            corretorNomes={pipeline.corretorNomes}
            onFilterLeads={(filterFn, label) => {
              // Apply a custom filter by setting stage filters or search
              toast.info(`Filtro aplicado: ${label}`);
              // Use the filter via the existing system
              const matchingStageIds = pipeline.stages
                .filter(s => pipeline.leads.some(l => filterFn(l) && l.stage_id === s.id))
                .map(s => s.id);
              setFilters(f => ({ ...f, stages: matchingStageIds }));
            }}
            onDispatch={() => setDispatchOpen(true)}
            onReload={() => pipeline.reload()}
          />
        )}
        {isKanbanOrIntel && activeTab === "kanban" && isGestor && !isAdmin && (
          <PipelineManagerActions
            leads={pipeline.leads}
            corretorNomes={pipeline.corretorNomes}
          />
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
          ) : activeTab === "automacoes" ? (
            autoView === "materiais" ? (
              <div className="h-full overflow-auto p-1">
                <MaterialsLibrary />
              </div>
            ) : (
              <div className="h-full overflow-auto p-1 space-y-6">
                <SequenceLibrary onSequenceCreated={() => pipeline.reload()} />
                <SequenceBuilder />
              </div>
            )
          ) : activeTab === "relatorios" ? (
            <PipelineReportsDashboard
              stages={pipeline.stages}
              leads={pipeline.leads}
              corretorNomes={pipeline.corretorNomes}
            />
          ) : null}
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
          onOpenChange={(open) => !open && setSelectedLead(null)}
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
    </div>
  );
}
