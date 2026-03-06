
CREATE OR REPLACE FUNCTION public.get_individual_oa_ranking(p_period text DEFAULT 'hoje')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_result jsonb;
BEGIN
  IF p_period = 'hoje' THEN
    v_since := (v_today::text || 'T00:00:00-03:00')::timestamptz;
  ELSIF p_period = 'semana' THEN
    v_since := ((v_today - EXTRACT(DOW FROM v_today)::int + 1)::text || 'T00:00:00-03:00')::timestamptz;
  ELSIF p_period = 'mes' THEN
    v_since := (date_trunc('month', v_today)::date::text || 'T00:00:00-03:00')::timestamptz;
  ELSE
    v_since := (v_today::text || 'T00:00:00-03:00')::timestamptz;
  END IF;

  SELECT jsonb_build_object(
    'ranking', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.pontos DESC)
      FROM (
        SELECT
          ot.corretor_id,
          COALESCE(p.nome, 'Corretor') AS nome,
          p.avatar_url,
          COUNT(ot.id)::int AS tentativas,
          COUNT(ot.id) FILTER (WHERE ot.resultado = 'com_interesse')::int AS aproveitados,
          SUM(ot.pontos)::int AS pontos,
          COUNT(ot.id) FILTER (WHERE ot.canal = 'ligacao')::int AS ligacoes,
          COUNT(ot.id) FILTER (WHERE ot.canal = 'whatsapp')::int AS whatsapps,
          COUNT(ot.id) FILTER (WHERE ot.canal = 'email')::int AS emails
        FROM oferta_ativa_tentativas ot
        LEFT JOIN profiles p ON p.user_id = ot.corretor_id
        WHERE ot.created_at >= v_since
        GROUP BY ot.corretor_id, p.nome, p.avatar_url
        ORDER BY SUM(ot.pontos) DESC
      ) r
    ), '[]'::jsonb),
    'total_tentativas', (
      SELECT COALESCE(COUNT(*)::int, 0)
      FROM oferta_ativa_tentativas
      WHERE created_at >= v_since
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
