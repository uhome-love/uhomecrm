import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";
import { useMotorFila, useMotorActions } from "@/hooks/useMotorReengajamento";

export default function FilaVivaCard() {
  const fila = useMotorFila();
  const { sweep } = useMotorActions();
  const runs = fila.data ?? [];
  const totalPending = runs.reduce((s, r) => s + r.pending, 0);
  const totalProcessing = runs.reduce((s, r) => s + r.processing, 0);

  async function runSweep() {
    try {
      const n = await sweep.mutateAsync();
      toast.success(n > 0 ? `${n} itens travados liberados` : "Nada travado no momento");
    } catch (e) {
      toast.error("Erro no sweep: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Fila viva
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runSweep} disabled={sweep.isPending}>
            {sweep.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            Sweep travados
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {totalPending} pendentes · {totalProcessing} em envio · {runs.length} run(s) viva(s)
        </p>
      </CardHeader>
      <CardContent>
        {fila.isLoading ? (
          <div className="py-6 flex justify-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…</div>
        ) : runs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nenhum run ativo. Fila limpa.</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const proc = r.enviados + r.falhas + r.ignorados;
              const pct = r.total_alvo > 0 ? Math.round((proc / r.total_alvo) * 100) : 0;
              return (
                <div key={r.id} className="rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={r.status === "paused" ? "outline" : "default"} className="text-[10px]">
                        {r.status}
                      </Badge>
                      <span className="text-xs font-medium truncate">
                        {r.audience_source || "run"} · {formatBRT(r.started_at, "dd/MM HH:mm")}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {proc}/{r.total_alvo} · {pct}%
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                    <span className="text-emerald-700">✓ {r.enviados}</span>
                    <span className="text-rose-700">✗ {r.falhas}</span>
                    <span className="text-muted-foreground">↷ {r.ignorados}</span>
                    <span className="text-blue-700 text-right">{r.pending}p / {r.processing}⚡</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
