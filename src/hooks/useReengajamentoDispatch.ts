import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DispatchRun } from "@/components/central-nutricao/types";

const STALE_RUNNING_MS = 6 * 60 * 1000;

export const REENGAJAMENTO_ACTIVE_RUN_KEY = ["reengajamento-active-run"] as const;

async function getPendingCount(runId: string) {
  const { count, error } = await supabase
    .from("reengajamento_dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .in("status", ["pending", "processing"]);
  if (error) throw error;
  return count || 0;
}

async function fetchCurrentRun(): Promise<(DispatchRun & { pending_count: number }) | null> {
  const { data, error } = await supabase
    .from("reengajamento_dispatch_runs")
    .select("*")
    .in("status", ["running", "paused"])
    .order("started_at", { ascending: false })
    .limit(5);
  if (error) throw error;

  for (const run of data || []) {
    const pendingCount = await getPendingCount(run.id);
    if (pendingCount > 0) {
      if (
        run.status === "running" &&
        run.started_at &&
        Date.now() - new Date(run.started_at).getTime() > STALE_RUNNING_MS
      ) {
        void supabase.functions.invoke("reengajamento-descartados-enqueue", {
          body: { force: true, run_id: run.id, iniciado_por: "auto_resume_ui" },
        });
      }
      return { ...run, pending_count: pendingCount };
    }
  }
  return null;
}

export function useReengajamentoDispatch() {
  const queryClient = useQueryClient();
  const activeRunQuery = useQuery({
    queryKey: REENGAJAMENTO_ACTIVE_RUN_KEY,
    queryFn: fetchCurrentRun,
    refetchInterval: (query) => (query.state.data ? 3000 : 15000),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: REENGAJAMENTO_ACTIVE_RUN_KEY }),
      queryClient.invalidateQueries({ queryKey: ["reengajamento-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["reengajamento-config"] }),
      queryClient.invalidateQueries({ queryKey: ["reengajamento-config-banner"] }),
    ]);
  };

  const pause = useMutation({
    mutationFn: async () => {
      const run = activeRunQuery.data;
      if (!run) throw new Error("Nenhum disparo ativo");
      const { data: config, error: configError } = await supabase
        .from("reengajamento_config")
        .select("id")
        .limit(1)
        .single();
      if (configError) throw configError;
      const { error } = await supabase
        .from("reengajamento_config")
        .update({ paused: true, paused_reason: "Pausa solicitada pelo usuário" })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const stop = useMutation({
    mutationFn: async () => {
      const run = activeRunQuery.data;
      if (!run) throw new Error("Nenhum disparo ativo");
      const { error } = await supabase
        .from("reengajamento_dispatch_runs")
        .update({ cancel_requested: true, motivo_parada: "Parada solicitada pelo usuário" })
        .eq("id", run.id);
      if (error) throw error;
      const { data, error: invokeError } = await supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, run_id: run.id, iniciado_por: "manual_stop_ui" },
      });
      if (invokeError) throw invokeError;
      if (data?.reason !== "cancelled" && data?.cancelled !== true) {
        throw new Error(data?.message || "O motor ainda não confirmou a parada");
      }
    },
    onSettled: refresh,
  });

  const resume = useMutation({
    mutationFn: async () => {
      const run = activeRunQuery.data;
      if (!run) throw new Error("Nenhuma fila pausada");
      const { data: config, error: configError } = await supabase
        .from("reengajamento_config")
        .select("id")
        .limit(1)
        .single();
      if (configError) throw configError;
      const { error: unlockError } = await supabase
        .from("reengajamento_config")
        .update({
          paused: false,
          paused_until_release: false,
          paused_reason: null,
          guard_reset_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (unlockError) throw unlockError;
      const { data, error } = await supabase.functions.invoke("reengajamento-descartados-enqueue", {
        body: { force: true, run_id: run.id, iniciado_por: "manual_resume_ui" },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data.message || data.error || "Falha ao retomar");
      return data;
    },
    onSettled: refresh,
  });

  return { ...activeRunQuery, run: activeRunQuery.data, pause, stop, resume, refresh };
}