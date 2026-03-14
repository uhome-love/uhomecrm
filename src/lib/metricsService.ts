/**
 * metricsService.ts — Official Metrics Service Layer
 * 
 * Single entry point for all KPI data across the system.
 * Uses auth_user_id as the canonical identity key.
 * 
 * Consumers:
 *   - Broker Dashboard
 *   - Manager Dashboard  
 *   - CEO Dashboard
 *   - Rankings
 *   - Reports
 * 
 * Data Sources (SQL views):
 *   - v_kpi_ligacoes (calls/attempts)
 *   - v_kpi_visitas (visits)
 *   - v_kpi_negocios (deals)
 *   - v_kpi_gestao_leads (pipeline points)
 *   - v_kpi_presenca (checkpoint presence)
 *   - v_kpi_disponibilidade (real-time availability)
 *   - get_kpis_por_periodo() (aggregated RPC)
 */

import { supabase } from "@/integrations/supabase/client";
import { getMetricPeriodRange, periodToTimestamps } from "./metricDefinitions";

// ─── Types ───

export interface CorretorKPIs {
  auth_user_id: string;
  total_ligacoes: number;
  total_aproveitados: number;
  taxa_aproveitamento: number;
  visitas_marcadas: number;
  visitas_realizadas: number;
  visitas_no_show: number;
  propostas: number;
  vendas: number;
  vgv_gerado: number;
  vgv_assinado: number;
  pontos_gestao: number;
  dias_presente: number;
}

export interface MetricPeriod {
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

// ─── Core RPC: Aggregated KPIs ───

/**
 * Get all KPIs for one or all corretores in a date range.
 * This is the OFFICIAL method for fetching metrics.
 */
export async function fetchKPIs(
  period: MetricPeriod,
  userId?: string
): Promise<CorretorKPIs[]> {
  const { data, error } = await supabase.rpc("get_kpis_por_periodo", {
    p_start: period.start,
    p_end: period.end,
    p_user_id: userId || null,
  });

  if (error) {
    console.error("[metricsService] fetchKPIs error:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    auth_user_id: row.auth_user_id,
    total_ligacoes: Number(row.total_ligacoes) || 0,
    total_aproveitados: Number(row.total_aproveitados) || 0,
    taxa_aproveitamento: Number(row.taxa_aproveitamento) || 0,
    visitas_marcadas: Number(row.visitas_marcadas) || 0,
    visitas_realizadas: Number(row.visitas_realizadas) || 0,
    visitas_no_show: Number(row.visitas_no_show) || 0,
    propostas: Number(row.propostas) || 0,
    vendas: Number(row.vendas) || 0,
    vgv_gerado: Number(row.vgv_gerado) || 0,
    vgv_assinado: Number(row.vgv_assinado) || 0,
    pontos_gestao: Number(row.pontos_gestao) || 0,
    dias_presente: Number(row.dias_presente) || 0,
  }));
}

/**
 * Convenience: fetch KPIs using a named period ("hoje", "semana", "mes", "custom")
 */
export async function fetchKPIsByPeriod(
  period: string,
  userId?: string,
  customStart?: string,
  customEnd?: string
): Promise<CorretorKPIs[]> {
  const range = getMetricPeriodRange(period, customStart, customEnd);
  return fetchKPIs(range, userId);
}

/**
 * Fetch KPIs for a single corretor (convenience wrapper)
 */
export async function fetchMyKPIs(
  authUserId: string,
  period: string,
  customStart?: string,
  customEnd?: string
): Promise<CorretorKPIs | null> {
  const results = await fetchKPIsByPeriod(period, authUserId, customStart, customEnd);
  return results[0] || null;
}

// ─── Granular View Queries (for detailed breakdowns) ───

/**
 * Get detailed call attempts for a corretor
 */
export async function fetchCallDetails(
  authUserId: string,
  period: MetricPeriod
) {
  const { data, error } = await supabase
    .from("v_kpi_ligacoes" as any)
    .select("*")
    .eq("auth_user_id", authUserId)
    .gte("data", period.start)
    .lte("data", period.end);

  if (error) throw error;
  return data || [];
}

/**
 * Get detailed visits for a corretor
 */
export async function fetchVisitDetails(
  authUserId: string,
  period: MetricPeriod
) {
  const { data, error } = await supabase
    .from("v_kpi_visitas" as any)
    .select("*")
    .eq("auth_user_id", authUserId)
    .gte("data_criacao", period.start)
    .lte("data_criacao", period.end);

  if (error) throw error;
  return data || [];
}

/**
 * Get detailed deals for a corretor
 */
export async function fetchDealDetails(
  authUserId: string,
  period: MetricPeriod
) {
  const { data, error } = await supabase
    .from("v_kpi_negocios" as any)
    .select("*")
    .eq("auth_user_id", authUserId)
    .gte("data_criacao", period.start)
    .lte("data_criacao", period.end);

  if (error) throw error;
  return data || [];
}

/**
 * Get pipeline management point details
 */
export async function fetchGestaoDetails(
  authUserId: string,
  period: MetricPeriod
) {
  const { data, error } = await supabase
    .from("v_kpi_gestao_leads" as any)
    .select("*")
    .eq("auth_user_id", authUserId)
    .gte("data", period.start)
    .lte("data", period.end);

  if (error) throw error;
  return data || [];
}

/**
 * Get presence history for a corretor
 */
export async function fetchPresenceDetails(
  authUserId: string,
  period: MetricPeriod
) {
  const { data, error } = await supabase
    .from("v_kpi_presenca" as any)
    .select("*")
    .eq("auth_user_id", authUserId)
    .gte("data", period.start)
    .lte("data", period.end);

  if (error) throw error;
  return data || [];
}

// ─── Team Queries (for managers) ───

/**
 * Get KPIs for all team members of a manager
 */
export async function fetchTeamKPIs(
  gerenteAuthUserId: string,
  period: MetricPeriod
): Promise<CorretorKPIs[]> {
  // Get team member auth user IDs
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("gerente_id", gerenteAuthUserId)
    .eq("status", "ativo");

  const teamUserIds = (teamMembers || [])
    .map((m) => m.user_id)
    .filter(Boolean) as string[];

  if (teamUserIds.length === 0) return [];

  // Fetch KPIs for all team members in parallel
  const allKPIs = await fetchKPIs(period);
  return allKPIs.filter((k) => teamUserIds.includes(k.auth_user_id));
}

// ─── Ranking Score Calculation ───

export interface RankingScore {
  auth_user_id: string;
  score_prospeccao: number;
  score_gestao: number;
  score_vendas: number;
  score_eficiencia: number;
  score_total: number;
  kpis: CorretorKPIs;
}

/**
 * Calculate ranking scores from KPIs using official weights.
 * Weights: Prospecção 20%, Gestão 30%, Vendas 40%, Eficiência 10%
 */
export function calculateRankingScores(
  allKPIs: CorretorKPIs[]
): RankingScore[] {
  if (allKPIs.length === 0) return [];

  // Find max values for normalization
  const maxLigacoes = Math.max(...allKPIs.map((k) => k.total_ligacoes), 1);
  const maxAproveitados = Math.max(...allKPIs.map((k) => k.total_aproveitados), 1);
  const maxGestao = Math.max(...allKPIs.map((k) => k.pontos_gestao), 1);
  const maxVGV = Math.max(...allKPIs.map((k) => k.vgv_assinado), 1);
  const maxVisitas = Math.max(...allKPIs.map((k) => k.visitas_realizadas), 1);
  const maxPresenca = Math.max(...allKPIs.map((k) => k.dias_presente), 1);

  return allKPIs.map((kpi) => {
    const score_prospeccao =
      ((kpi.total_ligacoes / maxLigacoes) * 0.6 +
        (kpi.total_aproveitados / maxAproveitados) * 0.4) *
      100;

    const score_gestao = (kpi.pontos_gestao / maxGestao) * 100;

    const score_vendas =
      ((kpi.vgv_assinado / maxVGV) * 0.7 +
        (kpi.propostas / Math.max(...allKPIs.map((k) => k.propostas), 1)) * 0.3) *
      100;

    const score_eficiencia =
      ((kpi.visitas_realizadas / maxVisitas) * 0.4 +
        (kpi.taxa_aproveitamento / 100) * 0.3 +
        (kpi.dias_presente / maxPresenca) * 0.3) *
      100;

    const score_total =
      score_prospeccao * 0.2 +
      score_gestao * 0.3 +
      score_vendas * 0.4 +
      score_eficiencia * 0.1;

    return {
      auth_user_id: kpi.auth_user_id,
      score_prospeccao: Math.round(score_prospeccao * 10) / 10,
      score_gestao: Math.round(score_gestao * 10) / 10,
      score_vendas: Math.round(score_vendas * 10) / 10,
      score_eficiencia: Math.round(score_eficiencia * 10) / 10,
      score_total: Math.round(score_total * 10) / 10,
      kpis: kpi,
    };
  }).sort((a, b) => b.score_total - a.score_total);
}
