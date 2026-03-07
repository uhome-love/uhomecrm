import { useState, useMemo, useCallback, useEffect } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import PipelineFlowDashboard from "@/components/pipeline/PipelineFlowDashboard";
import MaterialsLibrary from "@/components/pipeline/MaterialsLibrary";
import SequenceBuilder from "@/components/pipeline/SequenceBuilder";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, LayoutGrid, X, SlidersHorizontal, CloudDownload, BarChart3, FolderOpen, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function PipelineKanban() {
  const pipeline = usePipeline();
  const { isGestor, isAdmin } = useUserRole();
  const { user: authUser } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [filterOrigem, setFilterOrigem] = useState<string>("all");
  const [filterCorretor, setFilterCorretor] = useState<string>("all");
  const [filterCampanha, setFilterCampanha] = useState<string>("all");
  const [filterGerente, setFilterGerente] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [parcerias, setParcerias] = useState<Record<string, string>>({});

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
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("kanban");
  // user already destructured above as authUser

  const canAdd = isGestor || isAdmin;

  const origens = useMemo(() => {
    const set = new Set<string>();
    pipeline.leads.forEach(l => { if (l.origem) set.add(l.origem); });
    return Array.from(set).sort();
  }, [pipeline.leads]);

  const campanhas = useMemo(() => {
    const set = new Set<string>();
    pipeline.leads.forEach(l => { if (l.empreendimento) set.add(l.empreendimento); });
    return Array.from(set).sort();
  }, [pipeline.leads]);

  const corretorList = useMemo(() => {
    const entries = Object.entries(pipeline.corretorNomes).sort((a, b) => a[1].localeCompare(b[1]));
    return entries;
  }, [pipeline.corretorNomes]);

  const filteredLeads = useMemo(() => {
    let result = pipeline.leads;
    if (filterSegmento !== "all") result = result.filter(l => l.segmento_id === filterSegmento);
    if (filterOrigem !== "all") result = result.filter(l => l.origem === filterOrigem);
    if (filterCorretor !== "all") result = result.filter(l => l.corretor_id === filterCorretor);
    if (filterCampanha !== "all") result = result.filter(l => l.empreendimento === filterCampanha);
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
  }, [pipeline.leads, filterSegmento, filterOrigem, filterCorretor, filterCampanha, searchQuery]);

  const totalVGV = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.valor_estimado || 0), 0),
    [filteredLeads]
  );

  const activeFiltersCount = (filterSegmento !== "all" ? 1 : 0) + (filterOrigem !== "all" ? 1 : 0) + (filterCorretor !== "all" ? 1 : 0) + (filterCampanha !== "all" ? 1 : 0) + (searchQuery ? 1 : 0);

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

  const clearFilters = () => {
    setFilterSegmento("all");
    setFilterOrigem("all");
    setFilterCorretor("all");
    setFilterCampanha("all");
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs */}
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
            </TabsList>
          </Tabs>

          {(activeTab === "kanban") && (
            <>
              <div className="relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md">
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
                <span className="hidden sm:inline">Filtros</span>
                {activeFiltersCount > 0 && (
                  <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[9px] rounded-full">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
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
              <Button
                variant="outline"
                size="icon"
                onClick={handleJetimobSync}
                disabled={syncing}
                className="h-9 w-9 sm:hidden shrink-0"
              >
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

        {/* Expandable filters */}
        {showFilters && activeTab === "kanban" && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-card animate-fade-in">
            <Select value={filterSegmento} onValueChange={setFilterSegmento}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
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
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                {origens.map(o => (
                  <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas campanhas</SelectItem>
                {campanhas.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
        {activeTab === "kanban" && (
          <div className="flex items-center gap-2 flex-wrap px-1">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {filteredLeads.length} oportunidades
              </span>
            </div>
            {totalVGV > 0 && (
              <span className="text-sm text-muted-foreground font-medium">
                • {formatVGV(totalVGV)} em VGV
              </span>
            )}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "kanban" ? (
          <PipelineBoard
            stages={pipeline.stages}
            leads={filteredLeads}
            segmentos={pipeline.segmentos}
            corretorNomes={pipeline.corretorNomes}
            parcerias={parcerias}
            onMoveLead={pipeline.moveLead}
            onSelectLead={setSelectedLead}
            onTransferred={(_leadId, corretorId, _corretorNome) => {
              pipeline.reload();
            }}
          />
        ) : activeTab === "flow" ? (
          <PipelineFlowDashboard
            stages={pipeline.stages}
            leads={pipeline.leads}
            corretorNomes={pipeline.corretorNomes}
          />
        ) : activeTab === "materiais" ? (
          <div className="h-full overflow-auto p-1">
            <MaterialsLibrary />
          </div>
        ) : activeTab === "sequencias" ? (
          <div className="h-full overflow-auto p-1">
            <SequenceBuilder />
          </div>
        ) : null}
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
