import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Play, Pause, Square } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";
import { produtoLabel } from "./useLiaHub";
import type { ReengajamentoRun } from "./useLiaReengajamento";
const STATUS_BADGE: Record<string, string> = {
 armado: "bg-muted text-foreground", ativo: "bg-success/10 text-success-700 dark:text-success",
 pausado: "bg-warning/10 text-warning-700 dark:text-warning", concluido: "bg-primary/10 text-primary", cancelado: "bg-danger/10 text-danger",
};
const STATUS_ROTULO: Record<string, string> = { armado: "Preparado", ativo: "Ativo", pausado: "Pausado", concluido: "Concluído", cancelado: "Cancelado" };
export default function LiaReengajamentoLotes({ runs, countsPorRun, countsIndisponiveis, mudarStatus }: {
 runs: ReengajamentoRun[]; countsPorRun: Map<string, Record<string, number>>; countsIndisponiveis: boolean;
 mudarStatus: { mutate: (v: { id: string; status: string }) => void };
}) {
 return <div className="space-y-3">{
runs.map((run) => {
              const contagemAusente = countsIndisponiveis || !countsPorRun.has(run.id);
              const c = countsPorRun.get(run.id) ?? {};
              const enviados = c.enviado ?? 0;
              const pendentes = c.pendente ?? 0;
              const erros = c.erro ?? 0;
              return (
                <div key={run.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_BADGE[run.status] ?? ""}>{STATUS_ROTULO[run.status] ?? run.status}</Badge>
                    <span className="text-sm font-medium">{run.nome ?? "Lote"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {run.modo === "produto" ? produtoLabel(run.produto_slug ?? "") : "Cardápio"} · {run.cap_dia}/dia · {formatBRT(run.criado_em, "dd/MM HH:mm")}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      {(run.status === "armado" || run.status === "pausado") && (
                        <Button size="sm" variant="default" className="h-8" onClick={() => mudarStatus.mutate({ id: run.id, status: "ativo" })}>
                          <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                        </Button>
                      )}
                      {run.status === "ativo" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => mudarStatus.mutate({ id: run.id, status: "pausado" })}>
                          <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
                        </Button>
                      )}
                      {run.status !== "concluido" && run.status !== "cancelado" && (
                        <Button size="sm" variant="ghost" className="h-8 text-danger" onClick={() => mudarStatus.mutate({ id: run.id, status: "cancelado" })}>
                          <Square className="mr-1 h-3.5 w-3.5" /> Parar
                        </Button>
                      )}
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                    <span>Lote: <b>{run.lote_total}</b></span>
                    <span className="text-success-700 dark:text-success">Enviados: <b>{contagemAusente ? "—" : enviados}</b></span>
                    <span className="text-muted-foreground">Pendentes: <b>{contagemAusente ? "—" : pendentes}</b></span>
                    {!contagemAusente && erros > 0 && <span className="text-danger">Erros: <b>{erros}</b></span>}
                  </div>
                </div>
              );
            })
}</div>;
}
