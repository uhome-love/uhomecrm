CREATE OR REPLACE FUNCTION public.oa_ranking_ligacoes(p_periodo text DEFAULT 'semana')
RETURNS TABLE(user_id uuid, nome text, avatar_url text, ligacoes int, aproveitados int, visitas int, posicao int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ini AS (
    SELECT CASE WHEN p_periodo = 'dia'
      THEN (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo'
      ELSE (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo' END AS t
  ), lig AS (
    SELECT corretor_id AS uid, count(*) FILTER (WHERE canal = 'ligacao') AS l,
           count(*) FILTER (WHERE resultado = 'com_interesse') AS a
      FROM oferta_ativa_tentativas, ini WHERE created_at >= ini.t GROUP BY 1
    UNION ALL
    SELECT corretor_id, count(*), count(*) FILTER (WHERE resultado IN ('aproveitado','com_interesse','visita_marcada'))
      FROM oferta_ativa_ligacoes, ini WHERE created_at >= ini.t GROUP BY 1
  ), vis AS (
    SELECT corretor_id AS uid, count(*) AS v FROM visitas_unicas, ini
     WHERE created_at >= ini.t AND status IN ('marcada','confirmada','realizada','reagendada') GROUP BY 1
  ), agg AS (
    SELECT uid, sum(l)::int AS l, sum(a)::int AS a FROM lig GROUP BY 1
  )
  SELECT p.user_id,
         split_part(coalesce(p.nome,''),' ',1) || coalesce(' ' || left(nullif(split_part(p.nome,' ',2),''),1) || '.', '') AS nome,
         p.avatar_url, agg.l, agg.a, coalesce(vis.v,0)::int,
         (row_number() OVER (ORDER BY agg.l DESC, agg.a DESC, coalesce(vis.v,0) DESC))::int
    FROM agg JOIN profiles p ON p.user_id = agg.uid
    LEFT JOIN vis ON vis.uid = agg.uid
   WHERE agg.l > 0
   ORDER BY agg.l DESC, agg.a DESC
   LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.oa_ranking_ligacoes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oa_ranking_ligacoes(text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.oa_ranking_ligacoes(text) IS 'Ranking de ligações (dia/semana BRT) da Oferta Ativa + Mutirão; só nome curto e contagens (usado no placar TV público).';