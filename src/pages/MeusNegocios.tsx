import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import LossReasonModal from "@/components/pipeline/LossReasonModal";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, X, SlidersHorizontal, Briefcase } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export default function MeusNegocios() {
  const pipeline = usePipeline("negocios");
  const { isGestor, isAdmin } = useUserRole();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filterCorretor, setFilterCorretor] = useState<string>("all");
  const [filterCampanha, setFilterCampanha] = useState<string>("all");
  const [filterTemperatura, setFilterTemperatura] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [parcerias, setParcerias] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Loss reason modal state
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const pendingMove = useRef<{ leadId: string; stageId: string } | null>(null);

  const lossLeadNome = useMemo(() => {
    if (!pendingMove.current) return "";
    return pipeline.leads.find(l => l.id === pendingMove.current!.leadId)?.nome || "";
  }, [lossModalOpen, pipeline.leads]);

  const handleMoveLead = useCallback((leadId: string, newStageId: string) => {
    const targetStage = pipeline.stages.find(s => s.id === newStageId);
    if (targetStage && (targetStage.tipo === "descarte" || targetStage.tipo === "caiu")) {
      pendingMove.current = { leadId, stageId: newStageId };
      setLossModalOpen(true);
      return;
    }
    pipeline.moveLead(leadId, newStageId);
  }, [pipeline]);

  const handleLossConfirm = useCallback(async (motivo: string, obs: string) => {
    if (!pendingMove.current) return;
    const { leadId, stageId } = pendingMove.current;
    // Save motivo_descarte with the move
    await pipeline.moveLead(leadId, stageId, motivo);
    // Also save obs in observacoes if provided
    if (obs.trim()) {
      await pipeline.updateLead(leadId, { observacoes: obs.trim() } as any);
    }
    pendingMove.current = null;
    setLossModalOpen(false);
  }, [pipeline]);

  const handleLossCancel = useCallback(() => {
    pendingMove.current = null;
    setLossModalOpen(false);
  }, []);

  const canAdd = isGestor || isAdmin;

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

  const campanhas = useMemo(() => {
    const set = new Set<string>();
    pipeline.leads.forEach(l => { if (l.empreendimento) set.add(l.empreendimento); });
    return Array.from(set).sort();
  }, [pipeline.leads]);

  const corretorList = useMemo(() => {
    return Object.entries(pipeline.corretorNomes).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pipeline.corretorNomes]);

  const filteredLeads = useMemo(() => {
    let result = pipeline.leads;
    if (filterCorretor !== "all") result = result.filter(l => l.corretor_id === filterCorretor);
    if (filterCampanha !== "all") result = result.filter(l => l.empreendimento === filterCampanha);
    if (filterTemperatura !== "all") result = result.filter(l => (l.temperatura || "morno") === filterTemperatura);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.empreendimento?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [pipeline.leads, filterCorretor, filterCampanha, filterTemperatura, searchQuery]);

  const totalVGV = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [filteredLeads]
  );

  const activeFiltersCount = (filterCorretor !== "all" ? 1 : 0) + (filterCampanha !== "all" ? 1 : 0) + (filterTemperatura !== "all" ? 1 : 0) + (searchQuery ? 1 : 0);

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

  const clearFilters = () => {
    setFilterCorretor("all");
    setFilterCampanha("all");
    setFilterTemperatura("all");
    setSearchQuery("");
  };

  if (pipeline.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando pipeline negócios...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Controls */}
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Pipeline Negócios</h1>
          </div>

          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar negócio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-card"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFiltersCount > 0 && (
              <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {canAdd && (
            <>
              <Button onClick={() => setAddOpen(true)} size="icon" className="h-9 w-9 sm:hidden shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
              <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9 hidden sm:flex">
                <Plus className="h-4 w-4" />
                Novo Negócio
              </Button>
            </>
          )}
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-card animate-fade-in">
            <Select value={filterCorretor} onValueChange={setFilterCorretor}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos corretores</SelectItem>
                {corretorList.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCampanha} onValueChange={setFilterCampanha}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos empreendimentos</SelectItem>
                {campanhas.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTemperatura} onValueChange={setFilterTemperatura}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Temperatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas temperaturas</SelectItem>
                <SelectItem value="quente">🔥 Quente</SelectItem>
                <SelectItem value="morno">🌡️ Morno</SelectItem>
                <SelectItem value="frio">❄️ Frio</SelectItem>
              </SelectContent>
            </Select>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-8 text-primary">
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center gap-2 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {filteredLeads.length} negócios
            </span>
          </div>
          {totalVGV > 0 && (
            <span className="text-sm text-muted-foreground font-medium">
              • {formatVGV(totalVGV)} em VGV
            </span>
          )}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              {filterCorretor !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilterCorretor("all")}>
                  {pipeline.corretorNomes[filterCorretor] || "Corretor"} ×
                </Badge>
              )}
              {filterCampanha !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilterCampanha("all")}>
                  {filterCampanha} ×
                </Badge>
              )}
              {filterTemperatura !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilterTemperatura("all")}>
                  {filterTemperatura === "quente" ? "🔥 Quente" : filterTemperatura === "morno" ? "🌡️ Morno" : "❄️ Frio"} ×
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PipelineBoard
          stages={pipeline.stages}
          leads={filteredLeads}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          parcerias={parcerias}
          onMoveLead={pipeline.moveLead}
          onSelectLead={setSelectedLead}
          onTransferred={() => { pipeline.reload(); }}
        />
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
