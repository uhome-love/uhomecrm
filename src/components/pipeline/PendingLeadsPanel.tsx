import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/customClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCw, Clock, User, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PendingLeadsPanel() {
  const qc = useQueryClient();
  const [redistributing, setRedistributing] = useState(false);

  const { data: pendingLeads = [], isLoading } = useQuery({
    queryKey: ["pending-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, origem, prioridade_lead, created_at, observacoes, reativado_por_nutricao")
        .eq("aceite_status", "pendente_distribuicao")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const handleRedistribute = async (segmentoId?: string) => {
    setRedistributing(true);
    try {
      const { data, error } = await supabase.functions.invoke("distribute-lead", {
        body: { action: "dispatch_fila_ceo", janela: null, segmento_id: segmentoId || null },
      });
      if (error) throw error;
      const result = data as any;
      const dispatched = result?.dispatched || 0;
      const failed = result?.failed || 0;
      if (dispatched > 0 && failed === 0) {
        toast.success(`${dispatched} leads redistribuídos!`);
      } else if (dispatched > 0) {
        toast.success(`${dispatched} leads redistribuídos, ${failed} ainda pendentes.`);
      } else {
        toast.error("Nenhum lead pôde ser redistribuído agora");
      }
      qc.invalidateQueries({ queryKey: ["pending-leads"] });
    } catch {
      toast.error("Erro ao redistribuir leads");
    }
    setRedistributing(false);
  };

  const prioridadeColor = (p: string) => {
    if (p === "alta") return "bg-destructive/10 text-destructive border-destructive/20";
    if (p === "baixa") return "bg-muted text-muted-foreground";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Leads Pendentes
            {pendingLeads.length > 0 && (
              <Badge variant="destructive" className="text-xs">{pendingLeads.length}</Badge>
            )}
          </CardTitle>
          <Button
            onClick={() => handleRedistribute()}
            disabled={redistributing || pendingLeads.length === 0}
            size="sm"
            className="gap-1.5"
          >
            {redistributing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            Reinserir na Roleta
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Leads que não foram distribuídos por falta de corretor, fora do horário ou timeout múltiplo
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : pendingLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead pendente 🎉</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {pendingLeads.map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{lead.nome}</span>
                    <Badge className={`text-[9px] px-1.5 ${prioridadeColor(lead.prioridade_lead)}`}>
                      {lead.prioridade_lead === "alta" ? "ALTA" : lead.prioridade_lead === "baixa" ? "BAIXA" : "MÉDIA"}
                    </Badge>
                    {lead.reativado_por_nutricao && (
                      <Badge className="text-[9px] px-1.5 bg-purple-500/10 text-purple-600 border-purple-500/20">
                        🔄 Nutrição
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {lead.empreendimento && (
                      <span className="text-[10px] text-primary flex items-center gap-0.5">
                        <Building2 className="h-2.5 w-2.5" /> {lead.empreendimento}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(lead.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                </div>
                {lead.telefone && (
                  <span className="text-[10px] text-muted-foreground shrink-0">{lead.telefone}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
