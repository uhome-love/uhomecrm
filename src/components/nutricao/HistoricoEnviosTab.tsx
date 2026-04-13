import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, MessageCircle, Mail } from "lucide-react";
import { format } from "date-fns";

export default function HistoricoEnviosTab() {
  const [filtroCanal, setFiltroCanal] = useState("todos");

  const { data: envios = [], isLoading } = useQuery({
    queryKey: ["nurturing-historico", filtroCanal],
    queryFn: async () => {
      let query = supabase
        .from("lead_nurturing_sequences")
        .select("*, pipeline_leads(nome)")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(200);

      if (filtroCanal !== "todos") {
        query = query.eq("canal", filtroCanal);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const statusColor: Record<string, string> = {
    enviado: "bg-green-100 text-green-800",
    erro: "bg-red-100 text-red-800",
    cancelado: "bg-gray-100 text-gray-600",
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando histórico...</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Envios
          </CardTitle>
          <Badge variant="secondary">{envios.length} envios</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={filtroCanal} onValueChange={setFiltroCanal}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {envios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum envio registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Data</th>
                  <th className="text-left py-2 px-2 font-medium">Lead</th>
                  <th className="text-center py-2 px-2 font-medium">Canal</th>
                  <th className="text-left py-2 px-2 font-medium">Template</th>
                  <th className="text-center py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {envios.map((e: any) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2">
                      {e.sent_at ? format(new Date(e.sent_at), "dd/MM HH:mm") : "—"}
                    </td>
                    <td className="py-2 px-2 font-medium">{e.pipeline_leads?.nome || "—"}</td>
                    <td className="py-2 px-2 text-center">
                      {e.canal === "whatsapp" ? (
                        <MessageCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 text-blue-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono">{e.template_name}</td>
                    <td className="py-2 px-2 text-center">
                      <Badge className={`text-[10px] ${statusColor[e.status] || ""}`}>{e.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
