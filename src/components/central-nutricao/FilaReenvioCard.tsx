import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";
import type { DispatchQueueItem } from "./types";

type FailedItem = Pick<
  DispatchQueueItem,
  "id" | "run_id" | "nome" | "telefone" | "status" | "error_text" | "attempts" | "created_at" | "template_name"
>;

export default function FilaReenvioCard() {
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const { data: falhas = [], isFetching } = useQuery({
    queryKey: ["reengajamento-fila-reenvio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reengajamento_dispatch_queue")
        .select("id, run_id, nome, telefone, status, error_text, attempts, created_at, template_name")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as FailedItem[];
    },
    refetchInterval: 20000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reengajamento-fila-reenvio"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
    qc.invalidateQueries({ queryKey: ["auditoria-meta-today"] });
  };

  async function retry(queueIds: string[], label: string) {
    try {
      const { data, error } = await supabase.functions.invoke("reengajamento-retry-falhas", {
        body: { queue_ids: queueIds },
      });
      if (error) throw error;
      const reset = (data as { reset?: number } | null)?.reset ?? 0;
      if (reset === 0) toast.info("Nenhuma falha pendente para reenviar.");
      else toast.success(`🔁 ${label}: ${reset} lead(s) reenviado(s) para a fila.`);
      invalidate();
    } catch (e) {
      toast.error("Erro no reenvio: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleRetryOne(id: string) {
    setRetryingId(id);
    await retry([id], "Reenvio");
    setRetryingId(null);
  }

  async function handleRetryAll() {
    if (falhas.length === 0) return;
    setRetryingAll(true);
    await retry(falhas.map((f) => f.id), "Reenvio em lote");
    setRetryingAll(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Fila de reenvio
            {falhas.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{falhas.length}</Badge>
            )}
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Leads cujo disparo falhou. Reenvie individualmente ou todos de uma vez — o disparador
            reprocessa em modo manual.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["reengajamento-fila-reenvio"] })}
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleRetryAll}
            disabled={retryingAll || falhas.length === 0}
          >
            {retryingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
            Tentar todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {falhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Nenhuma falha na fila — tudo entregue ou pendente.</p>
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Lead</th>
                    <th className="text-left py-2 px-2 font-medium">Telefone</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-center py-2 px-2 font-medium">Tentativas</th>
                    <th className="text-left py-2 px-2 font-medium">Motivo da falha</th>
                    <th className="text-left py-2 px-2 font-medium">Quando</th>
                    <th className="text-center py-2 px-2 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {falhas.map((f) => (
                    <tr key={f.id} className="border-b hover:bg-muted/30 align-top">
                      <td className="py-2 px-2 font-medium">{f.nome || "—"}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{f.telefone || "—"}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge className="bg-red-100 text-red-800 text-[10px]">❌ Falha</Badge>
                      </td>
                      <td className="py-2 px-2 text-center">{f.attempts ?? 0}</td>
                      <td className="py-2 px-2 max-w-[320px]">
                        <span className="text-[11px] text-muted-foreground line-clamp-2 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                          {f.error_text || "Motivo não informado"}
                        </span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{f.created_at ? formatBRT(f.created_at, "dd/MM HH:mm") : "—"}</td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => handleRetryOne(f.id)}
                          disabled={retryingId === f.id || retryingAll}
                        >
                          {retryingId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {falhas.map((f) => (
                <div key={f.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{f.nome || "—"}</span>
                    <Badge className="bg-red-100 text-red-800 text-[10px] shrink-0">❌ Falha</Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{f.telefone || "—"} · {f.attempts ?? 0} tentativa(s)</div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                    {f.error_text || "Motivo não informado"}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">{f.created_at ? formatBRT(f.created_at, "dd/MM HH:mm") : "—"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => handleRetryOne(f.id)}
                      disabled={retryingId === f.id || retryingAll}
                    >
                      {retryingId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "🔁 Tentar novamente"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
