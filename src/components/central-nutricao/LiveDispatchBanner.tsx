import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";
import { useReengajamentoDispatch } from "@/hooks/useReengajamentoDispatch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

/**
 * Banner global que aparece em qualquer aba da Central de Reengajamento
 * sempre que houver um disparo em execução. Permite pausar imediatamente.
 */
export default function LiveDispatchBanner() {
  const { run: activeRun, pause, stop, resume } = useReengajamentoDispatch();

  if (!activeRun) return null;

  const isPaused = activeRun.status === "paused";
  const isPausing = pause.isPending;
  const isStopping = stop.isPending || !!activeRun.cancel_requested;
  const processados =
    (activeRun.enviados || 0) + (activeRun.falhas || 0) + (activeRun.ignorados || 0);
  const progressPct =
    activeRun.total_alvo > 0 ? Math.round((processados / activeRun.total_alvo) * 100) : 0;

  async function pausarDisparo() {
    try {
      await pause.mutateAsync();
      toast.success("Pausa solicitada — o disparo para após a mensagem em curso (retomável)");
    } catch (error) {
      toast.error("Erro ao pausar: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function pararDisparo() {
    try {
      await stop.mutateAsync();
      toast.success("Parada solicitada — o disparo será encerrado após a mensagem em curso");
    } catch (error) {
      toast.error("Erro ao parar: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function retomarDisparo() {
    try {
      const result = await resume.mutateAsync();
      if (result.paused) {
        toast.warning(result.motivo || "O disparo foi pausado novamente pela proteção de qualidade");
      } else {
        toast.success(`Disparo retomado — ${result.pendingCount} pendentes`);
      }
    } catch (error) {
      toast.error("Erro ao retomar: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  return (
    <Card className="border-blue-300 bg-blue-50/40 dark:bg-blue-950/20">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2 text-sm font-medium">
            {isPaused ? <Pause className="h-4 w-4 text-amber-600" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            {isPaused ? "Disparo pausado" : "Disparo em andamento"}
            {isStopping ? (
              <Badge className="bg-rose-200 text-rose-900 hover:bg-rose-200">Parando…</Badge>
            ) : isPausing && (
              <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200">Pausando…</Badge>
            )}
          </span>
          <div className="flex items-center gap-2">
            {isPaused ? (
              <Button size="sm" onClick={retomarDisparo} disabled={resume.isPending || isStopping} className="h-8">
                {resume.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                Retomar
              </Button>
            ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={pausarDisparo}
              disabled={isPausing || isStopping}
              className="h-8"
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              {isPausing ? "Pausando…" : "Pausar"}
            </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={isStopping} className="h-8">
                  <Square className="h-3.5 w-3.5 mr-1" />
                  {isStopping ? "Parando…" : "Parar"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Parar este disparo definitivamente?</AlertDialogTitle>
                  <AlertDialogDescription>Os destinatários restantes serão cancelados e esta fila não poderá ser retomada.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={pararDisparo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Parar disparo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span>
            <strong>{processados}</strong> / {activeRun.total_alvo || 0} processados · {activeRun.pending_count} pendentes
          </span>
          <span className="text-muted-foreground">
            ✉️ {activeRun.enviados || 0} · ⚠️ {activeRun.falhas || 0} · ⏭️{" "}
            {activeRun.ignorados || 0}
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
        <p className="text-[10px] text-muted-foreground">
          Iniciado {formatBRT(activeRun.started_at, "HH:mm:ss")}
          {activeRun.ultimo_lead_nome && (
            <>
              {" · "}último: <strong>{activeRun.ultimo_lead_nome}</strong>
            </>
          )}
        </p>
        {activeRun.motivo_parada && (
          <p className="text-[10px] text-amber-700 leading-relaxed">
            {activeRun.motivo_parada}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
