CREATE OR REPLACE FUNCTION public.get_individual_oa_ranking(p_period text DEFAULT 'hoje'::text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
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
  IF p_start IS NOT NULL AND p_end IS NOT NULL THEN
    v_since := (p_start::text || 'T00:00:00-03:00')::timestamptz;
    v_until := (p_end::text || 'T23:59:59.999-03:00')::timestamptz;
  ELSE
    IF p_period = 'hoje' THEN
      v_since := (v_today::text || 'T00:00:00-03:00')::timestamptz;
    ELSIF p_period = 'semana' THEN
      -- Semana começa na segunda; no domingo volta 6 dias (antes caía na segunda seguinte e zerava).
      v_since := ((v_today - ((EXTRACT(DOW FROM v_today)::int + 6) % 7))::text || 'T00:00:00-03:00')::timestamptz;
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