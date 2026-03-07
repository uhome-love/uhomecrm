import { useState, useMemo } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, X, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PosVendas() {
  const pipeline = usePipeline("pos_vendas");
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return pipeline.leads;
    const q = searchQuery.toLowerCase().trim();
    return pipeline.leads.filter(l =>
      l.nome.toLowerCase().includes(q) ||
      l.telefone?.toLowerCase().includes(q) ||
      l.empreendimento?.toLowerCase().includes(q)
    );
  }, [pipeline.leads, searchQuery]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await pipeline.reload();
    setRefreshing(false);
  };

  const handleSelectLead = (lead: PipelineLead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  if (pipeline.loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando pós-vendas...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Pipeline Pós-Vendas</h1>
            <Badge variant="secondary" className="text-[10px]">{pipeline.leads.length} clientes</Badge>
          </div>

          <div className="flex-1" />

          <div className="relative min-w-[160px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
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

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          <Button onClick={() => setAddOpen(true)} className="gap-1.5 h-9">
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <PipelineBoard
          stages={pipeline.stages}
          leads={filteredLeads}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          parcerias={{}}
          onMoveLead={pipeline.moveLead}
          onSelectLead={handleSelectLead}
        />
      </div>

      {selectedLead && (
        <PipelineLeadDetail
          lead={selectedLead}
          stages={pipeline.stages}
          segmentos={pipeline.segmentos}
          corretorNomes={pipeline.corretorNomes}
          open={detailOpen}
          onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedLead(null); }}
          onUpdate={pipeline.updateLead}
          onMove={pipeline.moveLead}
          onDelete={pipeline.deleteLead}
        />
      )}

      <PipelineAddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        stages={pipeline.stages}
        segmentos={pipeline.segmentos}
        onAdd={pipeline.addLead}
      />
    </div>
  );
}
