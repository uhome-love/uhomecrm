
-- Update get_individual_oa_ranking to support custom date range
DROP FUNCTION IF EXISTS public.get_individual_oa_ranking(text);

CREATE OR REPLACE FUNCTION public.get_individual_oa_ranking(
  p_period text DEFAULT 'hoje',
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_since timestamptz;
  v_until timestamptz;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_result jsonb;
BEGIN
  -- If custom range provided, use it
  IF p_start IS NOT NULL AND p_end IS NOT NULL THEN
    v_since := (p_start::text || 'T00:00:00-03:00')::timestamptz;
    v_until := (p_end::text || 'T23:59:59.999-03:00')::timestamptz;
  ELSE
    IF p_period = 'hoje' THEN
      v_since := (v_today::text || 'T00:00:00-03:00')::timestamptz;
    ELSIF p_period = 'semana' THEN
      v_since := ((v_today - EXTRACT(DOW FROM v_today)::int + 1)::text || 'T00:00:00-03:00')::timestamptz;
    ELSIF p_period = 'mes' THEN
      v_since := (date_trunc('month', v_today)::date::text || 'T00:00:00-03:00')::timestamptz;
    ELSE
      v_since := (v_today::text || 'T00:00:00-03:00')::timestamptz;
    END IF;
    v_until := now();
  END IF;

  SELECT jsonb_build_object(
    'ranking', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.pontos DESC, r.aproveitados DESC, r.tentativas DESC)
      FROM (
        SELECT
          tm.user_id AS corretor_id,
          COALESCE(p.nome, tm.nome, 'Corretor') AS nome,
          p.avatar_url,
          COALESCE(COUNT(ot.id)::int, 0) AS tentativas,
          COALESCE(COUNT(ot.id) FILTER (WHERE ot.resultado = 'com_interesse')::int, 0) AS aproveitados,
          COALESCE(SUM(ot.pontos)::int, 0) AS pontos,
          COALESCE(COUNT(ot.id) FILTER (WHERE ot.canal = 'ligacao')::int, 0) AS ligacoes,
          COALESCE(COUNT(ot.id) FILTER (WHERE ot.canal = 'whatsapp')::int, 0) AS whatsapps,
          COALESCE(COUNT(ot.id) FILTER (WHERE ot.canal = 'email')::int, 0) AS emails
        FROM team_members tm
        LEFT JOIN profiles p ON p.user_id = tm.user_id
        LEFT JOIN oferta_ativa_tentativas ot 
          ON ot.corretor_id = tm.user_id 
          AND ot.created_at >= v_since
          AND ot.created_at <= v_until
        WHERE tm.status = 'ativo'
          AND tm.user_id IS NOT NULL
        GROUP BY tm.user_id, p.nome, tm.nome, p.avatar_url
        ORDER BY COALESCE(SUM(ot.pontos)::int, 0) DESC, 
                 COALESCE(COUNT(ot.id) FILTER (WHERE ot.resultado = 'com_interesse')::int, 0) DESC
      ) r
    ), '[]'::jsonb),
    'total_tentativas', (
      SELECT COALESCE(COUNT(*)::int, 0)
      FROM oferta_ativa_tentativas
      WHERE created_at >= v_since
        AND created_at <= v_until
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Update get_ranking_gestao_leads to support custom date range
DROP FUNCTION IF EXISTS public.get_ranking_gestao_leads(text);

CREATE OR REPLACE FUNCTION public.get_ranking_gestao_leads(
  p_periodo text DEFAULT 'dia',
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL
)
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
        WHEN p_start IS NOT NULL THEN p_start
        WHEN p_periodo = 'semana' THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date - EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Sao_Paulo')::date)::int
        WHEN p_periodo = 'mes' THEN date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::date)::date
        ELSE (now() AT TIME ZONE 'America/Sao_Paulo')::date
      END AS data_inicio,
      CASE 
        WHEN p_end IS NOT NULL THEN (p_end::text || ' 23:59:59.999-03')::timestamptz
        ELSE now()
      END AS data_fim
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
      AND ph.created_at <= p.data_fim
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
