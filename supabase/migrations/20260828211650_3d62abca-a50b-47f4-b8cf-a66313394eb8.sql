CREATE OR REPLACE FUNCTION public.roleta_bloqueados_descarte()
RETURNS TABLE (
  corretor_id uuid,
  nome text,
  avatar_url text,
  descartes_mes integer,
  limite integer,
  ja_desbloqueado boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limite integer;
  v_mes text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'diretor')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE((SELECT valor::integer FROM public.roleta_config WHERE chave = 'limite_descartes_mes'), 100)
  INTO v_limite;

  RETURN QUERY
  WITH descartes AS (
    SELECT pl.corretor_id AS cid, COUNT(*)::integer AS qtd
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE COALESCE(ps.tipo::text, '') = 'descarte'
      AND pl.stage_changed_at >= date_trunc('month', CURRENT_DATE)
      AND pl.stage_changed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
      AND pl.corretor_id IS NOT NULL
    GROUP BY pl.corretor_id
  ),
  por_corretor AS (
    SELECT p.user_id AS uid,
           p.nome::text AS nome,
           p.avatar_url::text AS avatar_url,
           COALESCE(SUM(d.qtd), 0)::integer AS qtd
    FROM public.profiles p
    LEFT JOIN descartes d ON d.cid IN (p.user_id, p.id)
    GROUP BY p.user_id, p.nome, p.avatar_url
  )
  SELECT pc.uid,
         pc.nome,
         pc.avatar_url,
         pc.qtd,
         v_limite,
         EXISTS (
           SELECT 1 FROM public.roleta_desbloqueios rd
           WHERE rd.corretor_id = pc.uid AND rd.mes = v_mes
         )
  FROM por_corretor pc
  WHERE pc.qtd >= v_limite
  ORDER BY pc.qtd DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.roleta_bloqueados_descarte() TO authenticated;