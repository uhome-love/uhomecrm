/**
 * Checkpoint Service — Canonical compatibility layer
 * 
 * Provides unified checkpoint data access using auth_user_id as the canonical identity.
 * 
 * Identity Resolution:
 *   - checkpoint_diario.corretor_id = auth.users.id (already canonical)
 *   - checkpoint_lines.corretor_id = team_members.id (resolved via v_checkpoint_lines_canonical)
 *   - checkpoints.gerente_id = auth.users.id (already canonical)
 * 
 * SQL Views:
 *   - v_checkpoint_daily: checkpoint_diario enriched with team context
 *   - v_checkpoint_lines_canonical: checkpoint_lines with auth_user_id resolved
 * 
 * RPC:
 *   - get_checkpoint_summary(date, user_ids?): aggregated daily data with live OA overlay
 */

import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/paginatedFetch";
import { log } from "@/lib/logger";
import { generateTraceId } from "@/lib/traceContext";

// ─── Types ───

export interface CheckpointSummaryRow {
  auth_user_id: string;
  team_member_id: string;
  gerente_id: string;
  corretor_nome: string;
  presenca: string;
  meta_ligacoes: number;
  meta_aproveitados: number;
  meta_visitas_marcar: number;
  live_ligacoes: number;
  live_aproveitados: number;
  live_visitas_marcadas: number;
  live_visitas_realizadas: number;
  saved_res_ligacoes: number;
  saved_res_aproveitados: number;
  saved_res_visitas_marcadas: number;
  saved_res_visitas_realizadas: number;
  saved_res_propostas: number;
  obs_gerente: string;
  obs_dia: string;
  publicado: boolean;
}

export interface DailyOAStats {
  ligacoes: number;
  aproveitados: number;
}

export interface DailyVisitasStats {
  marcadas: number;
  realizadas: number;
}

// ─── Core Fetchers ───

/**
 * Fetch checkpoint summary via RPC — single query replaces 5-7 parallel queries
 * Returns data with both live OA stats and saved checkpoint values
 */
export async function fetchCheckpointSummary(
  date: string,
  userIds?: string[]
): Promise<CheckpointSummaryRow[]> {
  const traceId = generateTraceId();
  const { data, error } = await supabase.rpc("get_checkpoint_summary", {
    p_date: date,
    p_user_ids: userIds ?? null,
  });
  if (error) {
    log.error("checkpoint", "get_checkpoint_summary RPC failed", { traceId, date, userIds }, error);
    return [];
  }
  log.info("checkpoint", "Summary fetched", { traceId, date, count: data?.length ?? 0 });
  return (data || []) as CheckpointSummaryRow[];
}

/**
 * Fetch daily OA stats for given auth_user_ids on a specific date
 * Useful for components that need OA data independently of checkpoint
 */
export async function fetchDailyOAStats(
  date: string,
  userIds: string[]
): Promise<Record<string, DailyOAStats>> {
  if (userIds.length === 0) return {};
  
  const data = await fetchAllRows<{ corretor_id: string; resultado: string }>((from, to) =>
    supabase
      .from("oferta_ativa_tentativas")
      .select("corretor_id, resultado")
      .in("corretor_id", userIds)
      .gte("created_at", `${date}T00:00:00`)
      .lte("created_at", `${date}T23:59:59`)
      .range(from, to)
  );

  const result: Record<string, DailyOAStats> = {};
  for (const t of data || []) {
    if (!result[t.corretor_id]) result[t.corretor_id] = { ligacoes: 0, aproveitados: 0 };
    result[t.corretor_id].ligacoes++;
    if (t.resultado === "com_interesse") result[t.corretor_id].aproveitados++;
  }
  return result;
}

/**
 * Fetch daily visitas stats for given auth_user_ids on a specific date
 */
export async function fetchDailyVisitasStats(
  date: string,
  userIds: string[]
): Promise<Record<string, DailyVisitasStats>> {
  if (userIds.length === 0) return {};

  const [{ data: marcadas }, { data: realizadas }] = await Promise.all([
    supabase
      .from("visitas")
      .select("corretor_id")
      .in("corretor_id", userIds)
      .eq("data_visita", date),
    supabase
      .from("visitas")
      .select("corretor_id")
      .in("corretor_id", userIds)
      .eq("data_visita", date)
      .eq("status", "realizada"),
  ]);

  const result: Record<string, DailyVisitasStats> = {};
  for (const v of marcadas || []) {
    if (!result[v.corretor_id]) result[v.corretor_id] = { marcadas: 0, realizadas: 0 };
    result[v.corretor_id].marcadas++;
  }
  for (const v of realizadas || []) {
    if (!result[v.corretor_id]) result[v.corretor_id] = { marcadas: 0, realizadas: 0 };
    result[v.corretor_id].realizadas++;
  }
  return result;
}

/**
 * Fetch team members with auth_user_id for a gerente
 * Returns map: auth_user_id → { team_member_id, nome }
 */
export async function fetchTeamByGerente(
  gerenteId: string
): Promise<{ userIds: string[]; nameMap: Record<string, string>; memberMap: Record<string, string> }> {
  const { data } = await supabase
    .from("team_members")
    .select("id, user_id, nome")
    .eq("gerente_id", gerenteId)
    .eq("status", "ativo");

  const members = data || [];
  const userIds = members.map(m => m.user_id).filter(Boolean) as string[];
  const nameMap: Record<string, string> = {};
  const memberMap: Record<string, string> = {}; // auth_user_id → team_member_id
  for (const m of members) {
    if (m.user_id) {
      nameMap[m.user_id] = m.nome;
      memberMap[m.user_id] = m.id;
    }
  }
  return { userIds, nameMap, memberMap };
}

/**
 * Resolve effective metrics: picks live OA data when available, falls back to saved
 */
export function resolveEffectiveMetrics(row: CheckpointSummaryRow) {
  return {
    ligacoes: row.live_ligacoes > 0 ? row.live_ligacoes : row.saved_res_ligacoes,
    aproveitados: row.live_aproveitados > 0 ? row.live_aproveitados : row.saved_res_aproveitados,
    visitas_marcadas: row.live_visitas_marcadas > 0 ? row.live_visitas_marcadas : row.saved_res_visitas_marcadas,
    visitas_realizadas: row.live_visitas_realizadas > 0 ? row.live_visitas_realizadas : row.saved_res_visitas_realizadas,
    propostas: row.saved_res_propostas,
  };
}

/**
 * Fetch checkpoint_lines via canonical view for CEO dashboard
 * Returns lines with auth_user_id already resolved
 */
export async function fetchCanonicalCheckpointLines(
  date: string,
  gerenteIds?: string[]
): Promise<any[]> {
  let query = supabase
    .from("v_checkpoint_lines_canonical" as any)
    .select("*")
    .eq("checkpoint_date", date);

  if (gerenteIds && gerenteIds.length > 0) {
    query = query.in("checkpoint_gerente_id", gerenteIds);
  }

  const { data, error } = await query;
  if (error) {
    log.error("checkpoint", "v_checkpoint_lines_canonical query failed", { date, gerenteIds }, error);
    return [];
  }
  return data || [];
}

// ─── Identity Resolution Helpers ───

/**
 * Given a set of auth_user_ids, resolve their profile_ids
 * Needed for tables that still use profiles.id (negocios, roleta_credenciamentos)
 */
export async function resolveProfileIdsForUsers(
  authUserIds: string[]
): Promise<Map<string, string>> {
  if (authUserIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, user_id")
    .in("user_id", authUserIds);
  return new Map((data || []).map(p => [p.user_id!, p.id]));
}

/**
 * Given a set of team_member_ids, resolve their auth_user_ids
 * For backward compatibility with checkpoint_lines consumers
 */
export async function resolveAuthIdsForMembers(
  memberIds: string[]
): Promise<Map<string, string>> {
  if (memberIds.length === 0) return new Map();
  const { data } = await supabase
    .from("team_members")
    .select("id, user_id")
    .in("id", memberIds);
  return new Map(
    (data || []).filter(m => m.user_id).map(m => [m.id, m.user_id!])
  );
}
