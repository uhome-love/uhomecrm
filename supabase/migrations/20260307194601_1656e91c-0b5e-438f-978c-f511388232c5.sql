
-- RPC: Ranking de Gestão de Leads (cross-corretor ranking based on pipeline + OA activity)
-- Returns aggregated points per corretor for the current day (BRT timezone)

CREATE OR REPLACE FUNCTION public.get_ranking_gestao_leads(p_periodo text DEFAULT 'dia')
RETURNS TABLE(
  corretor_id uuid,
  corretor_nome text,
  pontos_total bigint,
  tentativas bigint,
  leads_responderam bigint,
  visitas_marcadas bigint,
  propostas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH periodo AS (
    SELECT 
      CASE 
        WHEN p_periodo = 'semana' THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date - EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int
        WHEN p_periodo = 'mes' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date
        ELSE (now() AT TIME ZONE 'America/Sao_Paulo')::date
      END AS data_inicio
  ),
  tentativas_agg AS (
    SELECT 
      t.corretor_id,
      COUNT(*) AS tentativas,
      SUM(t.pontos) AS pontos_oa,
      COUNT(*) FILTER (WHERE t.resultado = 'com_interesse') AS leads_responderam
    FROM oferta_ativa_tentativas t, periodo p
    WHERE t.created_at >= (p.data_inicio || ' 00:00:00-03')::timestamptz
    GROUP BY t.corretor_id
  ),
  visitas_agg AS (
    SELECT 
      v.corretor_id,
      COUNT(*) AS visitas_count
    FROM visitas v, periodo p
    WHERE v.created_at >= (p.data_inicio || ' 00:00:00-03')::timestamptz
      AND v.status IN ('marcada', 'confirmada', 'realizada')
    GROUP BY v.corretor_id
  ),
  propostas_agg AS (
    SELECT 
      pl.corretor_id,
      COUNT(*) AS propostas_count
    FROM pipeline_leads pl
    JOIN pipeline_stages ps ON ps.id = pl.stage_id
    WHERE ps.nome IN ('Proposta', 'Negociação', 'Assinatura', 'Venda')
      AND pl.corretor_id IS NOT NULL
    GROUP BY pl.corretor_id
  ),
  combined AS (
    SELECT 
      tm.user_id AS corretor_id,
      tm.nome AS corretor_nome,
      COALESCE(ta.pontos_oa, 0) 
        + COALESCE(va.visitas_count, 0) * 40 
        + COALESCE(pa.propostas_count, 0) * 80 AS pontos_total,
      COALESCE(ta.tentativas, 0) AS tentativas,
      COALESCE(ta.leads_responderam, 0) AS leads_responderam,
      COALESCE(va.visitas_count, 0) AS visitas_marcadas,
      COALESCE(pa.propostas_count, 0) AS propostas
    FROM team_members tm
    LEFT JOIN tentativas_agg ta ON ta.corretor_id = tm.user_id
    LEFT JOIN visitas_agg va ON va.corretor_id = tm.user_id
    LEFT JOIN propostas_agg pa ON pa.corretor_id = tm.user_id
    WHERE tm.status = 'ativo'
      AND tm.user_id IS NOT NULL
      AND (COALESCE(ta.tentativas, 0) + COALESCE(va.visitas_count, 0) + COALESCE(pa.propostas_count, 0)) > 0
  )
  SELECT * FROM combined
  ORDER BY pontos_total DESC
  LIMIT 50;
$$;
