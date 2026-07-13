import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";

export interface UltimoLead {
  id: string;
  nome: string | null;
  telefone: string | null;
  reengajamento_enviado_at: string | null;
  reengajamento_status: string | null;
  reativado_por_nutricao: boolean | null;
  reativado_em: string | null;
  ultimaResposta: { body: string; timestamp: string } | null;
}

function statusBadge(s: string | null) {
  if (s === "respondeu_sim") return <Badge className="bg-green-100 text-green-800 text-[10px]">✅ SIM</Badge>;
  if (s === "respondeu_nao") return <Badge className="bg-red-100 text-red-800 text-[10px]">❌ NÃO</Badge>;
  if (s === "respondeu_outro") return <Badge className="bg-blue-100 text-blue-800 text-[10px]">💬 Outro</Badge>;
  if (s === "telefone_invalido") return <Badge className="bg-gray-100 text-gray-800 text-[10px]">📵 Tel inválido</Badge>;
  if (s === "enviado") return <Badge className="bg-amber-100 text-amber-800 text-[10px]">⏳ Aguardando</Badge>;
  return <Badge variant="outline" className="text-[10px]">{s || "—"}</Badge>;
}

export default function ReengajamentoUltimos({
  ultimos,
  onRefresh,
  onReativar,
}: {
  ultimos: UltimoLead[];
  onRefresh: () => void;
  onReativar: (leadId: string, nome: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base">Últimos leads contatados</CardTitle>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {ultimos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum envio ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Lead</th>
                  <th className="text-left py-2 px-2 font-medium">Telefone</th>
                  <th className="text-left py-2 px-2 font-medium">Enviado</th>
                  <th className="text-center py-2 px-2 font-medium">Status</th>
                  <th className="text-left py-2 px-2 font-medium">Última resposta</th>
                  <th className="text-center py-2 px-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((l) => {
                  const podeReativar = !l.reativado_por_nutricao && (l.reengajamento_status === "respondeu_outro" || l.reengajamento_status === "respondeu_nao" || l.reengajamento_status === "enviado");
                  return (
                    <tr key={l.id} className="border-b hover:bg-muted/30 align-top">
                      <td className="py-2 px-2 font-medium">
                        {l.nome}
                        {l.reativado_por_nutricao && (
                          <Badge className="bg-orange-100 text-orange-800 text-[9px] ml-1">🔄 REATIVADO</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{l.telefone}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{l.reengajamento_enviado_at ? formatBRT(l.reengajamento_enviado_at, "dd/MM HH:mm") : "—"}</td>
                      <td className="py-2 px-2 text-center">{statusBadge(l.reengajamento_status)}</td>
                      <td className="py-2 px-2 max-w-[280px]">
                        {l.ultimaResposta ? (
                          <div className="text-[11px]">
                            <div className="text-foreground line-clamp-2">"{l.ultimaResposta.body}"</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{formatBRT(l.ultimaResposta.timestamp, "dd/MM HH:mm")}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {podeReativar ? (
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onReativar(l.id, l.nome || "lead")}>
                            🔄 Reativar
                          </Button>
                        ) : l.reativado_por_nutricao ? (
                          <span className="text-[10px] text-green-700"><CheckCircle2 className="inline h-3 w-3 mr-0.5" />Na roleta</span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
