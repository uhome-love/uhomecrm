/**
 * metricDefinitions.ts — Single Source of Truth for all metric definitions
 * 
 * Every dashboard, ranking, report, and table MUST reference these definitions
 * to ensure consistency across the entire UhomeSales system.
 * 
 * ══════════════════════════════════════════════════
 * CANONICAL IDENTITY: auth.users.id (auth_user_id)
 * ══════════════════════════════════════════════════
 * 
 * ALL metrics resolve to auth_user_id as the canonical corretor key.
 * Tables that historically used profiles.id now have an auth_user_id column.
 * 
 * === OFFICIAL DATA LAYER ===
 * 
 * SQL Views (source of truth for queries):
 *   v_kpi_ligacoes       → call attempts with auth_user_id
 *   v_kpi_visitas         → visits with auth_user_id
 *   v_kpi_negocios        → deals resolved to auth_user_id
 *   v_kpi_gestao_leads    → pipeline progression points
 *   v_kpi_presenca        → checkpoint presence resolved to auth_user_id
 *   v_kpi_disponibilidade → real-time availability
 * 
 * Aggregation RPC:
 *   get_kpis_por_periodo(p_start, p_end, p_user_id) → all KPIs aggregated
 * 
 * TypeScript Service:
 *   src/lib/metricsService.ts → fetchKPIs, fetchTeamKPIs, calculateRankingScores
 *   src/hooks/useKPIs.ts      → useMyKPIs, useTeamKPIs, useRankings, useAllKPIs
 * 
 * === METRIC DEFINITIONS ===
 * 
 * LIGAÇÃO (Call):
 *   View: v_kpi_ligacoes
 *   Source: oferta_ativa_tentativas
 *   Identity: corretor_id = auth.user_id (native)
 *   Filter: data within period
 * 
 * APROVEITADO (Interested Lead):
 *   View: v_kpi_ligacoes WHERE aproveitado = 1
 *   Filter: resultado = 'com_interesse'
 * 
 * TAXA DE CONVERSÃO OA:
 *   Formula: (aproveitados / tentativas) * 100
 * 
 * VISITA MARCADA:
 *   View: v_kpi_visitas WHERE conta_marcada = 1
 *   Identity: corretor_id = auth.user_id (native)
 *   Period: data_criacao (created_at) within period
 *   Statuses: marcada, confirmada, realizada, reagendada
 * 
 * VISITA REALIZADA:
 *   View: v_kpi_visitas WHERE conta_realizada = 1
 *   Period: data_visita within period AND status = 'realizada'
 * 
 * VISITA NO SHOW:
 *   View: v_kpi_visitas WHERE conta_no_show = 1
 *   Period: data_visita within period AND status = 'no_show'
 * 
 * PROPOSTA:
 *   View: v_kpi_negocios WHERE conta_proposta = 1
 *   Identity: auth_user_id (resolved from profiles.id via COALESCE)
 *   Phases: proposta, negociacao, documentacao
 *   Period: data_criacao within period
 * 
 * VGV GERADO:
 *   View: v_kpi_negocios
 *   Formula: SUM(vgv_estimado) for propostas + vendas created in period
 * 
 * VGV ASSINADO:
 *   View: v_kpi_negocios WHERE conta_venda = 1
 *   Value: COALESCE(vgv_final, vgv_estimado)
 *   Period: data_assinatura within period (NOT created_at)
 * 
 * PRESENÇA:
 *   View: v_kpi_presenca
 *   Identity: resolved via team_members.user_id → auth.user_id
 *   Counts: presente, home_office, externo
 * 
 * GESTÃO DE LEADS:
 *   View: v_kpi_gestao_leads
 *   Identity: pipeline_leads.corretor_id = auth.user_id (native)
 *   Points: Contato Iniciado (5), Qualificação (10), V.Marcada (30), V.Realizada (50)
 * 
 * === LEGACY ID MAPPING (being phased out) ===
 * 
 * Tables with auth_user_id backfill column (Phase 1 complete):
 *   negocios, checkpoint_diario, academia_progresso, academia_certificados,
 *   lead_progressao, roleta_credenciamentos, empreendimento_fichas, corretor_reports
 * 
 * Auto-populated via triggers on: negocios, roleta_credenciamentos
 */

export const METRIC_WEIGHTS = {
  RANKING_PROSPECCAO: 20,
  RANKING_GESTAO: 30,
  RANKING_VENDAS: 40,
  RANKING_EFICIENCIA: 10,
} as const;

export const GESTAO_POINTS = {
  CONTATO_INICIADO: 5,
  QUALIFICACAO: 10,
  VISITA_MARCADA: 30,
  VISITA_REALIZADA: 50,
} as const;

export const VISITA_STATUS_COUNTS_AS_MARCADA = ['marcada', 'confirmada', 'realizada', 'reagendada'] as const;
export const VISITA_STATUS_REALIZADA = 'realizada' as const;
export const VISITA_STATUS_NO_SHOW = 'no_show' as const;

export const PRESENCA_VALID = ['presente', 'home_office', 'externo'] as const;
export const DISPONIBILIDADE_ONLINE = ['online', 'na_empresa', 'disponivel', 'em_pausa', 'em_visita'] as const;

export const NEGOCIO_FASES_PROPOSTA = ['proposta', 'negociacao', 'documentacao'] as const;
export const NEGOCIO_FASES_ASSINADO = ['vendido'] as const;
export const NEGOCIO_FASES_PERDIDO = ['perdido', 'cancelado', 'distrato'] as const;

/**
 * Standard period range calculation for BRT timezone
 */
export function getMetricPeriodRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const todayBRT = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  
  if (period === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  
  if (period === "hoje" || period === "dia") {
    return { start: todayBRT, end: todayBRT };
  }
  
  if (period === "semana") {
    const d = new Date(todayBRT + "T12:00:00");
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split("T")[0],
      end: sunday.toISOString().split("T")[0],
    };
  }
  
  // mes
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    start: firstDay.toISOString().split("T")[0],
    end: lastDay.toISOString().split("T")[0],
  };
}

export function periodToTimestamps(range: { start: string; end: string }) {
  return {
    startTs: `${range.start}T00:00:00-03:00`,
    endTs: `${range.end}T23:59:59.999-03:00`,
  };
}
