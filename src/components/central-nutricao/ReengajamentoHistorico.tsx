import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import type { DispatchRun } from "./types";

function runStatusBadge(s: string) {
  const map: Record<string, { lbl: string; cls: string }> = {
    running: { lbl: "▶️ Em andamento", cls: "bg-blue-100 text-blue-800" },
    completed: { lbl: "✅ Concluído", cls: "bg-green-100 text-green-800" },
    paused: { lbl: "⏸️ Pausado", cls: "bg-amber-100 text-amber-800" },
    cancelled: { lbl: "⏹️ Parado", cls: "bg-rose-100 text-rose-800" },
    timeout: { lbl: "⏱️ Tempo limite", cls: "bg-orange-100 text-orange-800" },
    error: { lbl: "❌ Erro", cls: "bg-red-100 text-red-800" },
  };
  const m = map[s] || { lbl: s, cls: "bg-gray-100 text-gray-800" };
  return <Badge className={`${m.cls} text-[10px]`}>{m.lbl}</Badge>;
}

export default function ReengajamentoHistorico({
  runs,
  onRefresh,
}: {
  runs: DispatchRun[];
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-base">Histórico de disparos</CardTitle>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum disparo ainda</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Início</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-center py-2 px-2 font-medium">Enviados</th>
                  <th className="text-center py-2 px-2 font-medium">Falhas</th>
                  <th className="text-center py-2 px-2 font-medium">Ignorados</th>
                  <th className="text-left py-2 px-2 font-medium">Motivo da parada</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30 align-top">
                    <td className="py-2 px-2 whitespace-nowrap">{formatBRT(r.started_at, "dd/MM HH:mm:ss")}</td>
                    <td className="py-2 px-2">{runStatusBadge(r.status)}</td>
                    <td className="py-2 px-2 text-center font-semibold text-green-700">{r.enviados || 0}/{r.total_alvo || 0}</td>
                    <td className="py-2 px-2 text-center text-red-600">{r.falhas || 0}</td>
                    <td className="py-2 px-2 text-center text-amber-600">{r.ignorados || 0}</td>
                    <td className="py-2 px-2 max-w-[320px]">
                      <span className="text-[11px] text-muted-foreground line-clamp-2">{r.motivo_parada || "—"}</span>
                      {Array.isArray(r.erros) && r.erros.length > 0 && (
                        <details className="text-[10px] mt-1">
                          <summary className="cursor-pointer text-red-600">Ver {r.erros.length} erro(s)</summary>
                          <ul className="mt-1 space-y-0.5 max-h-32 overflow-auto">
                            {(r.erros as string[]).map((e, i) => (
                              <li key={i} className="text-muted-foreground"><AlertCircle className="inline h-3 w-3 mr-1" />{e}</li>
                            ))}
                          </ul>
                        </details>
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
  );
}
