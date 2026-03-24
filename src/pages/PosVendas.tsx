import { useState, useMemo } from "react";
import { usePipeline } from "@/hooks/usePipeline";
import PipelineBoard from "@/components/pipeline/PipelineBoard";
import PipelineLeadDetail from "@/components/pipeline/PipelineLeadDetail";
import PipelineAddLeadDialog from "@/components/pipeline/PipelineAddLeadDialog";
import type { PipelineLead } from "@/hooks/usePipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Loader2, Search, X, Heart, Gift, Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReferralDashboard from "@/components/referral/ReferralDashboard";
import ReferralAdminConfig from "@/components/referral/ReferralAdminConfig";
import { useUserRole } from "@/hooks/useUserRole";

export default function PosVendas() {
  const pipeline = usePipeline("pos_vendas");
  const { isAdmin } = useUserRole();
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
    <div className="bg-[#f0f0f5] dark:bg-[#0f0f12] p-6 -m-6 min-h-full flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      <Tabs defaultValue="pipeline" className="flex flex-col h-full">
        <div className="shrink-0 space-y-3 pb-3">
          <PageHeader
            title="Pós-vendas"
            subtitle="Acompanhamento após assinatura"
            icon={<Heart size={18} strokeWidth={1.5} />}
            actions={
              <Button onClick={() => setAddOpen(true)} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white gap-1.5 h-9">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            }
          />
        </div>

        <TabsContent value="pipeline" className="flex-1 min-h-0 overflow-hidden mt-0 flex flex-col">
          <div className="shrink-0 flex items-center gap-2 pb-3">
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
        </TabsContent>

        <TabsContent value="indicacoes" className="flex-1 overflow-auto mt-0">
          <ReferralDashboard />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="config" className="flex-1 overflow-auto mt-0">
            <ReferralAdminConfig />
          </TabsContent>
        )}
      </Tabs>

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
