import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface MotorHeartbeat {
  id: string;
  last_run_at: string | null;
  last_status: string | null;
  last_reason: string | null;
  last_batch_size: number | null;
  last_sent: number | null;
  last_error: string | null;
  updated_at: string;
}

export interface MotorConfig {
  id: string;
  paused: boolean;
  paused_reason: string | null;
  daily_limit: number;
  warmup_inicial: number;
  warmup_incremento_pct: number;
  warmup_started_at: string | null;
  warmup_pausado_ate: string | null;
  meta_template_name: string | null;
  ultimo_envio_at: string | null;
}

export interface MotorResumoHoje {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  responded: number;
  sim: number;
  nao: number;
}

export interface MotorQuality {
  verified_name: string | null;
  display_phone_number: string | null;
  quality_rating: QualityRating;
  messaging_limit_tier: string | null;
  messaging_limit: number | null;
  fetched_at: string;
}

export interface MotorFilaRun {
  id: string;
  status: string;
  started_at: string;
  total_alvo: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  audience_source: string | null;
  pending: number;
  processing: number;
}

export interface MotorFlags {
  campaign_dispatch_enabled: boolean;
}

export function useMotorHeartbeat() {
  return useQuery({
    queryKey: ["motor-heartbeat"],
    queryFn: async (): Promise<MotorHeartbeat | null> => {
      const { data, error } = await supabase
        .from("reengajamento_worker_heartbeat")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MotorHeartbeat) ?? null;
    },
    refetchInterval: 15000,
  });
}

export function useMotorConfig() {
  return useQuery({
    queryKey: ["motor-config"],
    queryFn: async (): Promise<MotorConfig | null> => {
      const { data, error } = await supabase
        .from("reengajamento_config")
        .select("id,paused,paused_reason,daily_limit,warmup_inicial,warmup_incremento_pct,warmup_started_at,warmup_pausado_ate,meta_template_name,ultimo_envio_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as MotorConfig) ?? null;
    },
    refetchInterval: 20000,
  });
}

export function useMotorResumoHoje() {
  return useQuery({
    queryKey: ["motor-resumo-hoje"],
    queryFn: async (): Promise<MotorResumoHoje> => {
      const { data, error } = await supabase.rpc("reengajamento_resumo_hoje");
      if (error) throw error;
      return (data ?? { total: 0, sent: 0, delivered: 0, read: 0, failed: 0, responded: 0, sim: 0, nao: 0 }) as MotorResumoHoje;
    },
    refetchInterval: 30000,
  });
}

export function useMotorCapDia() {
  return useQuery({
    queryKey: ["motor-cap-dia"],
    queryFn: async () => {
      const [capRes, sentRes] = await Promise.all([
        supabase.rpc("cap_do_dia"),
        supabase.rpc("enviados_hoje_reengajamento"),
      ]);
      if (capRes.error) throw capRes.error;
      if (sentRes.error) throw sentRes.error;
      return {
        cap: (capRes.data as number) ?? 0,
        enviados: (sentRes.data as number) ?? 0,
      };
    },
    refetchInterval: 30000,
  });
}

export function useMotorQuality() {
  return useQuery({
    queryKey: ["motor-quality"],
    queryFn: async (): Promise<MotorQuality | null> => {
      const { data, error } = await supabase.functions.invoke("meta-number-quality", { body: {} });
      if (error) return null;
      return data as MotorQuality;
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    retry: false,
  });
}

export function useMotorFila() {
  return useQuery({
    queryKey: ["motor-fila"],
    queryFn: async (): Promise<MotorFilaRun[]> => {
      const { data: runs, error } = await supabase
        .from("reengajamento_dispatch_runs")
        .select("id,status,started_at,total_alvo,enviados,falhas,ignorados,audience_source")
        .in("status", ["running", "paused"])
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      const out: MotorFilaRun[] = [];
      for (const r of runs || []) {
        const [pend, proc] = await Promise.all([
          supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", r.id).eq("status", "pending"),
          supabase.from("reengajamento_dispatch_queue").select("id", { count: "exact", head: true }).eq("run_id", r.id).eq("status", "processing"),
        ]);
        out.push({ ...(r as any), pending: pend.count || 0, processing: proc.count || 0 });
      }
      return out;
    },
    refetchInterval: 15000,
  });
}

export function useMotorFlags() {
  return useQuery({
    queryKey: ["motor-flags"],
    queryFn: async (): Promise<MotorFlags> => {
      const { data, error } = await supabase
        .from("system_flags")
        .select("flag_name,flag_value")
        .in("flag_name", ["campaign_dispatch_enabled"]);
      if (error) throw error;
      const map = new Map((data || []).map((r: any) => [r.flag_name, r.flag_value]));
      return { campaign_dispatch_enabled: !!map.get("campaign_dispatch_enabled") };
    },
    refetchInterval: 30000,
  });
}

export function useMotorActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["motor-heartbeat"] });
    qc.invalidateQueries({ queryKey: ["motor-config"] });
    qc.invalidateQueries({ queryKey: ["motor-fila"] });
    qc.invalidateQueries({ queryKey: ["motor-flags"] });
    qc.invalidateQueries({ queryKey: ["reengajamento-active-run"] });
  };

  const pause = useMutation({
    mutationFn: async (reason: string) => {
      const { data: cfg, error: e1 } = await supabase.from("reengajamento_config").select("id").limit(1).single();
      if (e1) throw e1;
      const { error } = await supabase
        .from("reengajamento_config")
        .update({ paused: true, paused_reason: reason })
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const resume = useMutation({
    mutationFn: async () => {
      const { data: cfg, error: e1 } = await supabase.from("reengajamento_config").select("id").limit(1).single();
      if (e1) throw e1;
      const { error } = await supabase
        .from("reengajamento_config")
        .update({ paused: false, paused_reason: null, paused_until_release: false })
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const sweep = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reengajamento_worker_sweep_stale");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSettled: invalidate,
  });

  const setGlobalGate = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("system_flags")
        .update({ flag_value: enabled, reason: `Alterado via painel Motor (${new Date().toISOString()})` })
        .eq("flag_name", "campaign_dispatch_enabled");
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  const setWarmupInicial = useMutation({
    mutationFn: async (valor: number) => {
      const { data: cfg, error: e1 } = await supabase.from("reengajamento_config").select("id").limit(1).single();
      if (e1) throw e1;
      const { error } = await supabase
        .from("reengajamento_config")
        .update({ warmup_inicial: valor })
        .eq("id", cfg.id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  return { pause, resume, sweep, setGlobalGate, setWarmupInicial };
}
