import { useState, useMemo, useCallback } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, X, SlidersHorizontal, CloudDownload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PipelineKanban() {
  const pipeline = usePipeline();
  const { isGestor, isAdmin } = useUserRole();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();

  const canAdd = isGestor || isAdmin;

  const origens = useMemo(() => {
    const set = new Set<string>();
    pipeline.leads.forEach(l => { if (l.origem) set.add(l.origem); });
    return Array.from(set).sort();
  }, [pipeline.leads]);

  const filteredLeads = useMemo(() => {
    let result = pipeline.leads;
    if (filterSegmento !== "all") result = result.filter(l => l.segmento_id === filterSegmento);
    if (filterOrigem !== "all") result = result.filter(l => l.origem === filterOrigem);
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
  }, [pipeline.leads, filterSegmento, filterOrigem, searchQuery]);

  const totalVGV = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [filteredLeads]
  );

  const activeFiltersCount = (filterSegmento !== "all" ? 1 : 0) + (filterOrigem !== "all" ? 1 : 0) + (searchQuery ? 1 : 0);

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
    if (!user) return;
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
  }, [user, pipeline]);

  const clearFilters = () => {
    setFilterSegmento("all");
    setFilterOrigem("all");
    setSearchQuery("");
  };

  if (pipeline.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando pipeline...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Controls — fixed top area */}
      <div className="shrink-0 space-y-3 pb-3">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
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
            Filtros
            {activeFiltersCount > 0 && (
              <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {canAdd && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleJetimobSync}
                disabled={syncing}
                className="gap-1.5 h-9"
              >
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
                {syncing ? "Sincronizando..." : "Sync Jetimob"}
              </Button>
              <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9">
                <Plus className="h-4 w-4" />
                Novo Lead
              </Button>
            </>
          )}
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-card animate-fade-in">
            <Select value={filterSegmento} onValueChange={setFilterSegmento}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos segmentos</SelectItem>
                {pipeline.segmentos.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                      {s.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOrigem} onValueChange={setFilterOrigem}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {origens.map(o => (
                  <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                ))}
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
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {filteredLeads.length} oportunidades
            </span>
          </div>
          {totalVGV > 0 && (
            <span className="text-sm text-muted-foreground font-medium">
              • {formatVGV(totalVGV)} em VGV
            </span>
          )}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {filterSegmento !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilterSegmento("all")}>
                  {pipeline.segmentos.find(s => s.id === filterSegmento)?.nome} ×
                </Badge>
              )}
              {filterOrigem !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer" onClick={() => setFilterOrigem("all")}>
                  {filterOrigem.replace(/_/g, " ")} ×
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board — fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PipelineBoard
          stages={pipeline.stages}
          leads={filteredLeads}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          onMoveLead={pipeline.moveLead}
          onSelectLead={setSelectedLead}
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
