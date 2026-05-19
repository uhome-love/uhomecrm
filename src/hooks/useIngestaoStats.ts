import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Periodo = "24h" | "7d" | "30d";

const RECEIVE_FNS = [
  "receive-meta-lead",
  "receive-imovelweb-lead",
  "receive-rdstation-lead",
  "receive-tiktok-lead",
  "receive-landing-lead",
  "crm-webhook",
];

const LEAD_CREATED_PREFIX = "Lead created via";

function periodoToHours(p: Periodo): number {
  return p === "24h" ? 24 : p === "7d" ? 168 : 720;
}

// BRT: calcula "since" a partir de agora menos N horas (BRT é -3h fixo)
function sinceIso(p: Periodo): string {
  return new Date(Date.now() - periodoToHours(p) * 3600_000).toISOString();
}

export interface KpiPorFn {
  fn: string;
  new_leads: number;       // Lead created via*
  total_events: number;    // todos info+error
  errors: number;          // level=error
}

export interface DestinoCounts {
  distribuidos: number;
  fila_ceo: number;
  dedup_reactivated: number;
  dedup_skipped_pending: number;
  dedup_skipped_permanent: number;
  insert_failed: number;
}

export interface DiarioRow {
  dia: string;
  message: string;
  qtd: number;
}

export interface TripwireStatus {
  level: "info" | "error" | null;
  message: string | null;
  ctx: Record<string, unknown> | null;
  created_at: string | null;
  status: "ok" | "stale" | "error" | "unknown";
  minutes_since: number | null;
}

export interface OpsEventRow {
  id: string;
  created_at: string;
  fn: string;
  level: string;
  category: string | null;
  message: string | null;
  ctx: Record<string, unknown> | null;
  error_detail: string | null;
  trace_id: string | null;
}

// ──────────────────────────────────────────────────────────────────
// KPI cards por função receive-*
// ──────────────────────────────────────────────────────────────────
export function useKpisPorFn(periodo: Periodo, paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "kpis-fn", periodo],
    queryFn: async (): Promise<KpiPorFn[]> => {
      const since = sinceIso(periodo);
      const { data, error } = await supabase
        .from("ops_events")
        .select("fn, level, message")
        .gte("created_at", since)
        .in("fn", RECEIVE_FNS)
        .limit(10000);
      if (error) throw error;

      const map = new Map<string, KpiPorFn>();
      for (const fn of RECEIVE_FNS) {
        map.set(fn, { fn, new_leads: 0, total_events: 0, errors: 0 });
      }
      for (const row of data ?? []) {
        const k = map.get(row.fn);
        if (!k) continue;
        k.total_events += 1;
        if (row.level === "error") k.errors += 1;
        if (typeof row.message === "string" && row.message.startsWith(LEAD_CREATED_PREFIX)) {
          k.new_leads += 1;
        }
      }
      return [...map.values()];
    },
    refetchInterval: paused ? false : 30_000,
    refetchOnWindowFocus: !paused,
    staleTime: 25_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Destino dos leads (counts)
// ──────────────────────────────────────────────────────────────────
const DESTINO_MESSAGES = [
  "queued_fila_ceo",
  "lead_dedup_reactivated",
  "lead_dedup_skipped_pending",
  "lead_dedup_skipped_permanent",
  "Lead insert failed",
];

export function useDestinoCounts(periodo: Periodo, paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "destino", periodo],
    queryFn: async (): Promise<DestinoCounts> => {
      const since = sinceIso(periodo);
      const [{ data: events, error: e1 }, { count: distribuidos, error: e2 }] =
        await Promise.all([
          supabase
            .from("ops_events")
            .select("message")
            .gte("created_at", since)
            .in("message", DESTINO_MESSAGES)
            .limit(10000),
          supabase
            .from("pipeline_leads")
            .select("id", { count: "exact", head: true })
            .gte("created_at", since)
            .not("corretor_id", "is", null),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const counts: Record<string, number> = {};
      for (const m of DESTINO_MESSAGES) counts[m] = 0;
      for (const row of events ?? []) {
        if (row.message && counts[row.message] !== undefined) counts[row.message] += 1;
      }
      return {
        distribuidos: distribuidos ?? 0,
        fila_ceo: counts["queued_fila_ceo"],
        dedup_reactivated: counts["lead_dedup_reactivated"],
        dedup_skipped_pending: counts["lead_dedup_skipped_pending"],
        dedup_skipped_permanent: counts["lead_dedup_skipped_permanent"],
        insert_failed: counts["Lead insert failed"],
      };
    },
    refetchInterval: paused ? false : 30_000,
    staleTime: 25_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Série diária (últimos 7d, agrupada por dia BRT)
// ──────────────────────────────────────────────────────────────────
export function useDiarioStacked(paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "diario-stacked"],
    queryFn: async (): Promise<DiarioRow[]> => {
      const since = sinceIso("7d");
      const { data, error } = await supabase
        .from("ops_events")
        .select("created_at, message")
        .gte("created_at", since)
        .in("message", DESTINO_MESSAGES)
        .limit(10000);
      if (error) throw error;

      // Agrupamento client-side em BRT (UTC-3 fixo)
      const bucket = new Map<string, number>();
      for (const row of data ?? []) {
        const d = new Date(row.created_at);
        // BRT = UTC - 3h
        const brt = new Date(d.getTime() - 3 * 3600_000);
        const dia = brt.toISOString().slice(0, 10);
        const key = `${dia}|${row.message}`;
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }
      return [...bucket.entries()].map(([k, qtd]) => {
        const [dia, message] = k.split("|");
        return { dia, message, qtd };
      });
    },
    refetchInterval: paused ? false : 60_000,
    staleTime: 50_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Tripwire status (com tolerância 15min)
// ──────────────────────────────────────────────────────────────────
export function useTripwireStatus(paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "tripwire"],
    queryFn: async (): Promise<TripwireStatus> => {
      const { data, error } = await supabase
        .from("ops_events")
        .select("created_at, level, message, ctx")
        .eq("fn", "secrets-tripwire")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (!row) {
        return {
          level: null, message: null, ctx: null, created_at: null,
          status: "unknown", minutes_since: null,
        };
      }
      const minutesSince = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60_000);
      let status: TripwireStatus["status"];
      if (row.level === "error") status = "error";
      else if (minutesSince > 15) status = "stale";
      else status = "ok";

      return {
        level: row.level as "info" | "error",
        message: row.message,
        ctx: row.ctx as Record<string, unknown> | null,
        created_at: row.created_at,
        status,
        minutes_since: minutesSince,
      };
    },
    refetchInterval: paused ? false : 30_000,
    staleTime: 25_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Avulso ImovelWeb count
// ──────────────────────────────────────────────────────────────────
export function useAvulsoImovelWeb(periodo: Periodo, paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "avulso-imovelweb", periodo],
    queryFn: async (): Promise<number> => {
      const since = sinceIso(periodo);
      // empreendimento ILIKE 'Avulso%' OR IS NULL, origem=imovelweb
      const { count, error } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .ilike("origem", "imovelweb")
        .or("empreendimento.is.null,empreendimento.ilike.Avulso%");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: paused ? false : 60_000,
    staleTime: 50_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Eventos recentes (50)
// ──────────────────────────────────────────────────────────────────
export function useEventosRecentes(periodo: Periodo, paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "eventos-recentes", periodo],
    queryFn: async (): Promise<OpsEventRow[]> => {
      const since = sinceIso(periodo);
      const { data, error } = await supabase
        .from("ops_events")
        .select("id, created_at, fn, level, category, message, ctx, error_detail, trace_id")
        .gte("created_at", since)
        .in("fn", [...RECEIVE_FNS, "distribute-lead"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as OpsEventRow[];
    },
    refetchInterval: paused ? false : 30_000,
    staleTime: 25_000,
  });
}

// ──────────────────────────────────────────────────────────────────
// Alertas Ativos de Saúde (edge-health-alert)
// Functions com alerta nas últimas 24h SEM recovery posterior.
// ──────────────────────────────────────────────────────────────────
export interface AlertaSaudeAtivo {
  fn: string;
  alerted_at: string;
  error_rate: number;
  total_calls: number;
  error_calls: number;
}

export function useEdgeHealthAlertasAtivos(paused: boolean) {
  return useQuery({
    queryKey: ["ingestao", "edge-health-ativos"],
    queryFn: async (): Promise<AlertaSaudeAtivo[]> => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();

      // 1. Pega todos os alerts e recoveries das últimas 24h
      const { data: events, error } = await supabase
        .from("ops_events")
        .select("created_at, category, message, ctx")
        .eq("fn", "edge-health-alert")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // 2. Agrupa: pra cada function, pega último alert e último recovery.
      type Ev = {
        created_at: string;
        category: string | null;
        message: string;
        ctx: Record<string, unknown> | null;
      };
      const lastAlert = new Map<string, Ev>();
      const lastRecovery = new Map<string, string>();
      for (const e of (events ?? []) as Ev[]) {
        const ctx = e.ctx ?? {};
        if (e.category === "alert") {
          const fn = ctx.function_alerted as string | undefined;
          if (fn && !lastAlert.has(fn)) lastAlert.set(fn, e);
        } else if (
          e.category === "business" &&
          e.message?.startsWith("edge-health-recovered")
        ) {
          const fn = ctx.function_recovered as string | undefined;
          if (fn && !lastRecovery.has(fn)) lastRecovery.set(fn, e.created_at);
        }
      }

      // 3. Ativo = alert sem recovery posterior
      const ativos: AlertaSaudeAtivo[] = [];
      for (const [fn, ev] of lastAlert.entries()) {
        const rec = lastRecovery.get(fn);
        if (rec && rec > ev.created_at) continue;
        const ctx = ev.ctx ?? {};
        ativos.push({
          fn,
          alerted_at: ev.created_at,
          error_rate: Number(ctx.error_rate ?? 0),
          total_calls: Number(ctx.total_calls ?? 0),
          error_calls: Number(ctx.error_calls ?? 0),
        });
      }
      ativos.sort((a, b) => b.alerted_at.localeCompare(a.alerted_at));
      return ativos;
    },
    refetchInterval: paused ? false : 5 * 60_000,
    staleTime: 4 * 60_000,
  });
}
