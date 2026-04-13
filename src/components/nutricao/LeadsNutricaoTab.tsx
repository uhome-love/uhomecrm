import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Pause, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function LeadsNutricaoTab() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroStageTipo, setFiltroStageTipo] = useState("todos");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["nurturing-leads", filtroStatus, filtroStageTipo],
    queryFn: async () => {
      let query = supabase
        .from("lead_nurturing_state")
        .select("*, pipeline_leads(nome, telefone, email, corretor_id, team_members(nome))")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus);
      }
      if (filtroStageTipo !== "todos") {
        query = query.eq("sequencia_ativa", filtroStageTipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("lead_nurturing_state")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // If pausing/encerring, cancel pending sequences
      if (status === "pausado" || status === "encerrado") {
        const state = leads.find(l => l.id === id);
        if (state) {
          await supabase
            .from("lead_nurturing_sequences")
            .update({ status: "cancelado" })
            .eq("pipeline_lead_id", state.pipeline_lead_id)
            .eq("status", "pendente");
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nurturing-leads"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const ativos = leads.filter(l => l.status === "ativo").length;

  const statusColor: Record<string, string> = {
    ativo: "bg-green-100 text-green-800",
    pausado: "bg-yellow-100 text-yellow-800",
    encerrado: "bg-gray-100 text-gray-600",
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando leads...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads em Nutrição
            </CardTitle>
            <Badge variant="secondary">{ativos} ativos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroStageTipo} onValueChange={setFiltroStageTipo}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Cadência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="descarte_reengajamento">Reengajamento Geral</SelectItem>
                <SelectItem value="descarte_reengajamento_financeiro">Reengajamento Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead em nutrição</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Lead</th>
                    <th className="text-left py-2 px-2 font-medium">Corretor</th>
                    <th className="text-left py-2 px-2 font-medium">Cadência</th>
                    <th className="text-center py-2 px-2 font-medium">Passo</th>
                    <th className="text-left py-2 px-2 font-medium">Próximo envio</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-right py-2 px-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l: any) => (
                    <tr key={l.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{l.pipeline_leads?.nome || "—"}</td>
                      <td className="py-2 px-2">{l.pipeline_leads?.team_members?.nome || "—"}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[10px]">{l.sequencia_ativa}</Badge>
                      </td>
                      <td className="py-2 px-2 text-center">{l.step_atual}</td>
                      <td className="py-2 px-2">
                        {l.proximo_step_at ? format(new Date(l.proximo_step_at), "dd/MM HH:mm") : "—"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge className={`text-[10px] ${statusColor[l.status] || ""}`}>{l.status}</Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {l.status === "ativo" && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Pausar"
                              onClick={() => updateStatus.mutate({ id: l.id, status: "pausado" })}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Encerrar"
                              onClick={() => updateStatus.mutate({ id: l.id, status: "encerrado" })}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
