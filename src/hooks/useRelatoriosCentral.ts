/**
 * useRelatoriosCentral — Orquestrador das 5 RPCs da Central de Relatórios v2.
 *
 * Faz 5 useQuery em paralelo (Pipeline Leads, Oferta Ativa, Visitas, Negócios,
 * Vendas). Cada query é independente: loading e erro isolados por seção.
 *
 * Não consome a RPC de ranking (Prompt 8).
 *
 * gestorId é resolvido pelo hook:
 *  - admin → params.equipe ?? user.id
 *  - gestor → sempre user.id
 *  - corretor → bloqueado pela rota antes de chegar aqui
 */
import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { formatBRT } from "@/lib/brtTime";
import type { CentralPeriodo } from "@/components/central-v2/useCentralUrlState";

const STALE_MS = 5 * 60 * 1000;
const GC_MS = 15 * 60 * 1000;

export interface CentralRange {
  start: string;       // 'yyyy-MM-dd' BRT
  end: string;
  prevStart: string;
  prevEnd: string;
}

export interface CentralFiltersInput {
  periodo: CentralPeriodo;
  de?: string;
  ate?: string;
  equipe?: string;
}

type RpcName =
  | "get_relatorio_pipeline_leads"
  | "get_relatorio_oferta_ativa"
  | "get_relatorio_visitas"
  | "get_relatorio_negocios"
  | "get_relatorio_vendas";

// ─────────────────────────────────────────────────────────────────
// Resolução de período → janela atual + janela anterior (mesmo tamanho)
// Toda a aritmética é feita em BRT (datas YYYY-MM-DD sem hora).
// ─────────────────────────────────────────────────────────────────
function brtTodayDate(): Date {
  const ymd = formatBRT(new Date(), "yyyy-MM-dd");
  return new Date(`${ymd}T00:00:00`);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolvePeriodo(
  periodo: CentralPeriodo,
  de?: string,
  ate?: string
): CentralRange {
  const today = brtTodayDate();

  let start: Date;
  let end: Date;

  switch (periodo) {
    case "hoje":
      start = today;
      end = today;
      break;
    case "semana": {
      // segunda → domingo da semana corrente
      const dow = (today.getDay() + 6) % 7; // 0 = segunda
      start = addDays(today, -dow);
      end = addDays(start, 6);
      break;
    }
    case "trimestre": {
      const q = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), q * 3, 1);
      end = new Date(today.getFullYear(), q * 3 + 3, 0);
      break;
    }
    case "custom": {
      start = de ? new Date(`${de}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1);
      end = ate ? new Date(`${ate}T00:00:00`) : today;
      break;
    }
    case "mes":
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
  }

  const lenDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(lenDays - 1));

  return {
    start: ymd(start),
    end: ymd(end),
    prevStart: ymd(prevStart),
    prevEnd: ymd(prevEnd),
  };
}

// ─────────────────────────────────────────────────────────────────
// Fetcher unificado
// ─────────────────────────────────────────────────────────────────
async function fetchRpc(
  rpc: RpcName,
  gestorId: string | undefined,
  range: CentralRange
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc(rpc, {
    p_gestor_id: gestorId ?? null, // null = "todas as equipes" (admin only)
    p_start: range.start,
    p_end: range.end,
    p_prev_start: range.prevStart,
    p_prev_end: range.prevEnd,
  } as never);

  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("forbidden") || msg.includes("unauthorized")) {
      throw new Error("forbidden");
    }
    throw error;
  }
  return (data as Record<string, unknown>) ?? {};
}

// ─────────────────────────────────────────────────────────────────
// Hook principal
// ─────────────────────────────────────────────────────────────────
export interface UseRelatoriosCentralResult {
  range: CentralRange;
  gestorId: string | null;
  pipelineLeads: UseQueryResult<Record<string, unknown>>;
  ofertaAtiva: UseQueryResult<Record<string, unknown>>;
  visitas: UseQueryResult<Record<string, unknown>>;
  negocios: UseQueryResult<Record<string, unknown>>;
  vendas: UseQueryResult<Record<string, unknown>>;
  isAnyLoading: boolean;
  isAllLoading: boolean;
}

export function useRelatoriosCentral(
  filters: CentralFiltersInput
): UseRelatoriosCentralResult {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const gestorId = useMemo<string | null | undefined>(() => {
    if (!user?.id) return null;                 // não autenticado → bloqueia query
    if (isAdmin) return filters.equipe ?? undefined; // admin sem equipe → undefined = todas
    return user.id;                             // gestor → próprio id
  }, [user?.id, isAdmin, filters.equipe]);

  const range = useMemo(
    () => resolvePeriodo(filters.periodo, filters.de, filters.ate),
    [filters.periodo, filters.de, filters.ate]
  );

  const keyId = gestorId ?? "ALL";

  const baseOpts = {
    enabled: gestorId !== null,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  };

  const pipelineLeads = useQuery({
    ...baseOpts,
    queryKey: ["central", "pipeline-leads", keyId, range.start, range.end],
    queryFn: () => fetchRpc("get_relatorio_pipeline_leads", gestorId ?? undefined, range),
  });
  const ofertaAtiva = useQuery({
    ...baseOpts,
    queryKey: ["central", "oferta-ativa", keyId, range.start, range.end],
    queryFn: () => fetchRpc("get_relatorio_oferta_ativa", gestorId ?? undefined, range),
  });
  const visitas = useQuery({
    ...baseOpts,
    queryKey: ["central", "visitas", keyId, range.start, range.end],
    queryFn: () => fetchRpc("get_relatorio_visitas", gestorId ?? undefined, range),
  });
  const negocios = useQuery({
    ...baseOpts,
    queryKey: ["central", "negocios", keyId, range.start, range.end],
    queryFn: () => fetchRpc("get_relatorio_negocios", gestorId ?? undefined, range),
  });
  const vendas = useQuery({
    ...baseOpts,
    queryKey: ["central", "vendas", keyId, range.start, range.end],
    queryFn: () => fetchRpc("get_relatorio_vendas", gestorId ?? undefined, range),
  });


  const all = [pipelineLeads, ofertaAtiva, visitas, negocios, vendas];
  const isAnyLoading = all.some((q) => q.isLoading);
  const isAllLoading = all.every((q) => q.isLoading);

  return {
    range,
    gestorId,
    pipelineLeads,
    ofertaAtiva,
    visitas,
    negocios,
    vendas,
    isAnyLoading,
    isAllLoading,
  };
}

/**
 * Placeholder para Prompt 7 — fetch isolado de uma RPC específica.
 * Útil para views individuais (?secao=vendas, etc.) consumidas no próximo prompt.
 */
export function useRelatorioIndividual(
  secao:
    | "pipeline-leads"
    | "oferta-ativa"
    | "visitas"
    | "negocios"
    | "vendas",
  filters: CentralFiltersInput
) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const gestorId = !user?.id
    ? null
    : isAdmin
      ? filters.equipe || user.id
      : user.id;
  const range = resolvePeriodo(filters.periodo, filters.de, filters.ate);

  const rpcMap: Record<string, RpcName> = {
    "pipeline-leads": "get_relatorio_pipeline_leads",
    "oferta-ativa": "get_relatorio_oferta_ativa",
    visitas: "get_relatorio_visitas",
    negocios: "get_relatorio_negocios",
    vendas: "get_relatorio_vendas",
  };

  return useQuery({
    queryKey: ["central", secao, gestorId, range.start, range.end],
    queryFn: () => fetchRpc(rpcMap[secao], gestorId as string, range),
    enabled: !!gestorId,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });
}
