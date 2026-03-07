import { useState, useMemo } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Filter, Loader2, Search, LayoutGrid } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";

export default function PipelineKanban() {
  const pipeline = usePipeline();
  const { isGestor, isAdmin } = useUserRole();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const canAdd = isGestor || isAdmin;

  const filteredLeads = useMemo(() => {
    let result = pipeline.leads;

    // Filter by segment
    if (filterSegmento !== "all") {
      result = result.filter(l => l.segmento_id === filterSegmento);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(l =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.empreendimento?.toLowerCase().includes(q) ||
        l.observacoes?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pipeline.leads, filterSegmento, searchQuery]);

  const totalVGV = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [filteredLeads]
  );

  const formatVGV = (value: number) => {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(3).replace(".", ",")}`;
    if (value >= 1_000) return `R$ ${value.toLocaleString("pt-BR")}`;
    return `R$ ${value}`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await pipeline.reload();
    setRefreshing(false);
  };

  if (pipeline.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Busque por nome, telefone, email ou observações"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterSegmento} onValueChange={setFilterSegmento}>
            <SelectTrigger className="w-[180px] h-10">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos segmentos</SelectItem>
              {pipeline.segmentos.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.cor }} />
                    {s.nome}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {canAdd && (
            <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-10">
              <Plus className="h-4 w-4" />
              Novo Lead
            </Button>
          )}
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">
          Oportunidades ({filteredLeads.length})
        </span>
        {totalVGV > 0 && (
          <span className="text-sm text-muted-foreground">
            {formatVGV(totalVGV)}
          </span>
        )}

        {/* Active filter chips */}
        <div className="flex items-center gap-2 ml-auto">
          {filterSegmento !== "all" && (
            <button
              onClick={() => setFilterSegmento("all")}
              className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md hover:bg-muted/80"
            >
              Segmento: {pipeline.segmentos.find(s => s.id === filterSegmento)?.nome}
              <span className="text-muted-foreground ml-0.5">×</span>
            </button>
          )}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md hover:bg-muted/80"
            >
              Busca: "{searchQuery}"
              <span className="text-muted-foreground ml-0.5">×</span>
            </button>
          )}
          {(filterSegmento !== "all" || searchQuery) && (
            <button
              onClick={() => { setFilterSegmento("all"); setSearchQuery(""); }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <PipelineBoard
        stages={pipeline.stages}
        leads={filteredLeads}
        segmentos={pipeline.segmentos}
        onMoveLead={pipeline.moveLead}
        onSelectLead={setSelectedLead}
      />

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
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
          onUpdate={pipeline.updateLead}
          onMove={pipeline.moveLead}
        />
      )}
    </div>
  );
}
