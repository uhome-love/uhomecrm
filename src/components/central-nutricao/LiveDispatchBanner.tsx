import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Pause, Square } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

const STALE_RUNNING_MS = 15 * 60 * 1000;

async function recoverOrTimeoutStaleRun(data: any, qc: ReturnType<typeof useQueryClient>) {
  const { count } = await supabase
    .from("reengajamento_dispatch_queue" as any)
    .select("id", { count: "exact", head: true })
    .eq("run_id", data.id)
    .in("status", ["pending", "processing"]);

  if ((count || 0) > 0) {
    await supabase
      .from("reengajamento_dispatch_runs" as any)
      .update({
        started_at: new Date().toISOString(),
        finished_at: null,
        status: "running",
        motivo_parada: `Fila persistente ativa: ${(count || 0)} pendentes. Retomada automática acionada.`,
      })
      .eq("id", data.id);

    supabase.functions.invoke("reengajamento-descartados-enqueue", {
      body: { force: true, run_id: data.id, iniciado_por: "auto_resume_banner" },
    });

    return data;
  }

  await supabase
    .from("reengajamento_dispatch_runs" as any)
    .update({
      status: "timeout",
      finished_at: new Date().toISOString(),
      motivo_parada: "Encerrado automaticamente: execução antiga ficou travada sem fila pendente",
    })
    .eq("id", data.id);
  qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
  return null;
}

/**
 * Banner global que aparece em qualquer aba da Central de Reengajamento
 * sempre que houver um disparo em execução. Permite pausar imediatamente.
 */
export default function LiveDispatchBanner() {
  const qc = useQueryClient();

  const { data: activeRun } = useQuery({
    queryKey: ["reengajamento-active-run"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reengajamento_dispatch_runs" as any)
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.started_at && Date.now() - new Date(data.started_at).getTime() > STALE_RUNNING_MS) {
        return recoverOrTimeoutStaleRun(data, qc);
      }
      return data as any;
    },
    refetchInterval: (query) => (query.state.data ? 3000 : 15000),
  });

  const { data: cfg } = useQuery({
    queryKey: ["reengajamento-config-banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reengajamento_config" as any)
        .select("id, paused")
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: 4000,
  });

  if (!activeRun) return null;

  const isPausing = !!cfg?.paused && !!activeRun;
  const isStopping = !!activeRun?.cancel_requested;
  const processados =
    (activeRun.enviados || 0) + (activeRun.falhas || 0) + (activeRun.ignorados || 0);
  const progressPct =
    activeRun.total_alvo > 0 ? Math.round((processados / activeRun.total_alvo) * 100) : 0;

  async function pausarDisparo() {
    if (!cfg?.id) {
      toast.error("Configuração não encontrada");
      return;
    }
    try {
      await supabase
        .from("reengajamento_config" as any)
        .update({ paused: true })
        .eq("id", cfg.id);
      if (activeRun?.id) {
        await supabase
          .from("reengajamento_dispatch_runs" as any)
          .update({
            status: "paused",
            finished_at: new Date().toISOString(),
            motivo_parada: "Pausado pelo usuário",
            enviados: activeRun.enviados || 0,
            falhas: activeRun.falhas || 0,
            ignorados: activeRun.ignorados || 0,
          })
          .eq("id", activeRun.id);
      }
      toast.success("Pausa solicitada — o disparo para após a mensagem em curso (retomável)");
      qc.invalidateQueries({ queryKey: ["reengajamento-config-banner"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-config"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    } catch (e: any) {
      toast.error("Erro ao pausar: " + e.message);
    }
  }

  async function pararDisparo() {
    if (!activeRun?.id) return;
    if (!confirm("Parar este disparo definitivamente? Os leads restantes não serão enviados e o disparo não poderá ser retomado.")) return;
    try {
      await supabase
        .from("reengajamento_dispatch_runs" as any)
        .update({
          cancel_requested: true,
          status: "cancelled",
          finished_at: new Date().toISOString(),
          motivo_parada: "Parado pelo usuário",
          enviados: activeRun.enviados || 0,
          falhas: activeRun.falhas || 0,
          ignorados: activeRun.ignorados || 0,
        })
        .eq("id", activeRun.id);
      toast.success("Parada solicitada — o disparo será encerrado após a mensagem em curso");
      qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
      qc.invalidateQueries({ queryKey: ["reengajamento-runs"] });
    } catch (e: any) {
      toast.error("Erro ao parar: " + e.message);
    }
  }

  return (
    <Card className="border-blue-300 bg-blue-50/40 dark:bg-blue-950/20">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Disparo em andamento
            {isStopping ? (
              <Badge className="bg-rose-200 text-rose-900 hover:bg-rose-200">Parando…</Badge>
            ) : isPausing && (
              <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200">Pausando…</Badge>
            )}
          </span>
          <div className="flex items-center gap-2">
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
            <Button
              size="sm"
              variant="destructive"
              onClick={pararDisparo}
              disabled={isStopping}
              className="h-8"
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              {isStopping ? "Parando…" : "Parar"}
            </Button>
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span>
            <strong>{processados}</strong> / {activeRun.total_alvo || 0} processados
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
      </CardContent>
    </Card>
  );
}
