
DROP FUNCTION IF EXISTS public.get_ranking_gestao_leads(text);

CREATE OR REPLACE FUNCTION public.get_ranking_gestao_leads(p_periodo text)
RETURNS TABLE(
  corretor_id uuid,
  corretor_nome text,
  pontos_total bigint,
  contatos bigint,
  qualificados bigint,
  visitas_marcadas bigint,
  visitas_realizadas bigint
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
  stage_map AS (
    SELECT id, nome FROM pipeline_stages
  ),
  historico_agg AS (
    SELECT 
      pl.corretor_id,
      COUNT(*) FILTER (WHERE sn.nome = 'Contato Iniciado') AS contatos,
      COUNT(*) FILTER (WHERE sn.nome = 'Qualificação') AS qualificados,
      COUNT(*) FILTER (WHERE sn.nome = 'Visita Marcada') AS visitas_marcadas,
      COUNT(*) FILTER (WHERE sn.nome = 'Visita Realizada') AS visitas_realizadas
    FROM pipeline_historico ph
    JOIN pipeline_leads pl ON pl.id = ph.pipeline_lead_id
    JOIN stage_map sn ON sn.id = ph.stage_novo_id
    CROSS JOIN periodo p
    WHERE ph.created_at >= (p.data_inicio || ' 00:00:00-03')::timestamptz
      AND pl.corretor_id IS NOT NULL
    GROUP BY pl.corretor_id
  ),
  combined AS (
    SELECT 
      tm.user_id AS corretor_id,
      tm.nome AS corretor_nome,
      COALESCE(ha.contatos, 0) * 5 
        + COALESCE(ha.qualificados, 0) * 10
        + COALESCE(ha.visitas_marcadas, 0) * 30
        + COALESCE(ha.visitas_realizadas, 0) * 50 AS pontos_total,
      COALESCE(ha.contatos, 0) AS contatos,
      COALESCE(ha.qualificados, 0) AS qualificados,
      COALESCE(ha.visitas_marcadas, 0) AS visitas_marcadas,
      COALESCE(ha.visitas_realizadas, 0) AS visitas_realizadas
    FROM team_members tm
    LEFT JOIN historico_agg ha ON ha.corretor_id = tm.user_id
    WHERE tm.status = 'ativo'
      AND tm.user_id IS NOT NULL
      AND (COALESCE(ha.contatos, 0) + COALESCE(ha.qualificados, 0) + COALESCE(ha.visitas_marcadas, 0) + COALESCE(ha.visitas_realizadas, 0)) > 0
  )
  SELECT * FROM combined
  ORDER BY pontos_total DESC
  LIMIT 50;
$$;
