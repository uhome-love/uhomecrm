CREATE OR REPLACE FUNCTION public.get_relatorio_equipes(
  p_gestor_id uuid,
  p_start date,
  p_end date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_team_auth uuid[];
  v_team_prof uuid[];
  v_result jsonb;
  v_neg_stage uuid := 'de6cee2f-8dda-4e60-a4e2-6b7f21aeae96'; -- Em Negociação
  v_descarte uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_caiu uuid := '43997e74-aa71-4796-b7d0-11abae2d49ac';
  v_ganho uuid := '2d7739eb-1787-4ad6-887a-7a4a32dcfc05';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF p_gestor_id IS NULL THEN
    IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    v_team_auth := ARRAY(SELECT DISTINCT user_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL)
                || ARRAY(SELECT DISTINCT gerente_id FROM team_members WHERE status='ativo' AND gerente_id IS NOT NULL);
  ELSE
    IF auth.uid() <> p_gestor_id AND NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretor'::app_role)) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    v_team_auth := ARRAY(SELECT user_id FROM team_members WHERE gerente_id=p_gestor_id AND status='ativo') || ARRAY[p_gestor_id];
  END IF;

  v_team_prof := ARRAY(SELECT id FROM profiles WHERE user_id = ANY(v_team_auth));

  WITH base AS (
    SELECT DISTINCT
           tm.user_id   AS auth_id,
           p.id         AS profile_id,
           p.nome       AS corretor_nome,
           p.avatar_url,
           tm.gerente_id AS gerente_auth,
           pg.nome      AS gerente_nome
    FROM team_members tm
    JOIN profiles p  ON p.user_id = tm.user_id
    JOIN profiles pg ON pg.user_id = tm.gerente_id
    WHERE tm.user_id = ANY(v_team_auth) AND tm.status='ativo' AND tm.gerente_id IS NOT NULL
  ),
  leads AS (
    SELECT corretor_id AS auth_id, COUNT(*)::int AS leads_recebidos
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  vis AS (
    SELECT corretor_id AS auth_id,
           COUNT(*) FILTER (
             WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
           )::int AS visitas_marcadas,
           COUNT(*) FILTER (
             WHERE status='realizada' AND data_visita BETWEEN p_start AND p_end
           )::int AS visitas_realizadas
    FROM visitas
    WHERE corretor_id = ANY(v_team_auth)
    GROUP BY 1
  ),
  pipe AS (
    SELECT corretor_id AS auth_id,
           COUNT(*) FILTER (
             WHERE COALESCE(arquivado,false)=false
               AND stage_id NOT IN (v_descarte, v_caiu, v_ganho)
           )::int AS pipeline_ativo,
           COUNT(*) FILTER (
             WHERE COALESCE(arquivado,false)=false AND stage_id = v_neg_stage
           )::int AS negocios_andamento,
           COUNT(*) FILTER (
             WHERE tipo_descarte IS NOT NULL
               AND (updated_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
           )::int AS descartes,
           COUNT(*) FILTER (WHERE estagnado = true)::int AS estagnados
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
    GROUP BY 1
  ),
  vendas AS (
    SELECT corretor_id AS profile_id,
           COUNT(*)::int AS vendas_assinadas,
           SUM(COALESCE(vgv_final, vgv_estimado))::numeric AS vgv
    FROM negocios
    WHERE corretor_id = ANY(v_team_prof)
      AND fase = 'vendido'
      AND data_assinatura BETWEEN p_start AND p_end
    GROUP BY 1
  ),
  corretores AS (
    SELECT
      b.gerente_auth,
      b.gerente_nome,
      b.corretor_nome,
      b.avatar_url,
      COALESCE(l.leads_recebidos,0)     AS leads_recebidos,
      COALESCE(vi.visitas_marcadas,0)   AS visitas_marcadas,
      COALESCE(vi.visitas_realizadas,0) AS visitas_realizadas,
      COALESCE(pp.pipeline_ativo,0)     AS pipeline_ativo,
      COALESCE(pp.negocios_andamento,0) AS negocios_andamento,
      COALESCE(pp.descartes,0)          AS descartes,
      COALESCE(pp.estagnados,0)         AS estagnados,
      COALESCE(v.vendas_assinadas,0)    AS vendas_assinadas,
      COALESCE(v.vgv,0)                 AS vgv
    FROM base b
    LEFT JOIN leads  l  ON l.auth_id    = b.auth_id
    LEFT JOIN vis    vi ON vi.auth_id   = b.auth_id
    LEFT JOIN pipe   pp ON pp.auth_id   = b.auth_id
    LEFT JOIN vendas v  ON v.profile_id = b.profile_id
  ),
  neg_list AS (
    SELECT
      bg.gerente_nome AS equipe,
      p.nome          AS corretor,
      pl.nome         AS cliente,
      pl.empreendimento,
      pl.valor_estimado,
      GREATEST(0, (CURRENT_DATE - (pl.stage_changed_at AT TIME ZONE 'America/Sao_Paulo')::date))::int AS dias_na_etapa
    FROM pipeline_leads pl
    JOIN profiles p ON p.user_id = pl.corretor_id
    JOIN LATERAL (
      SELECT pg.nome AS gerente_nome
      FROM team_members tm JOIN profiles pg ON pg.user_id = tm.gerente_id
      WHERE tm.user_id = pl.corretor_id AND tm.status='ativo' AND tm.gerente_id IS NOT NULL
      LIMIT 1
    ) bg ON true
    WHERE pl.corretor_id = ANY(v_team_auth)
      AND pl.stage_id = v_neg_stage
      AND COALESCE(pl.arquivado,false)=false
  ),
  emp AS (
    SELECT COALESCE(NULLIF(TRIM(empreendimento),''),'(Sem empreendimento)') AS empreendimento,
           COUNT(*)::int AS leads
    FROM pipeline_leads
    WHERE corretor_id = ANY(v_team_auth)
      AND (COALESCE(distribuido_em, created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_start AND p_end
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('start', p_start, 'end', p_end),
    'corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'gerente_id', gerente_auth,
        'gerente_nome', gerente_nome,
        'nome', corretor_nome,
        'avatar_url', avatar_url,
        'leads_recebidos', leads_recebidos,
        'visitas_marcadas', visitas_marcadas,
        'visitas_realizadas', visitas_realizadas,
        'pipeline_ativo', pipeline_ativo,
        'negocios_andamento', negocios_andamento,
        'descartes', descartes,
        'estagnados', estagnados,
        'vendas_assinadas', vendas_assinadas,
        'vgv', vgv
      ) ORDER BY gerente_nome, vgv DESC, corretor_nome) FROM corretores), '[]'::jsonb),
    'negocios_andamento', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'equipe', equipe,
        'corretor', corretor,
        'cliente', cliente,
        'empreendimento', empreendimento,
        'valor_estimado', valor_estimado,
        'dias_na_etapa', dias_na_etapa
      ) ORDER BY dias_na_etapa DESC) FROM neg_list), '[]'::jsonb),
    'top_empreendimentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'empreendimento', empreendimento, 'leads', leads
      ) ORDER BY leads DESC) FROM emp), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_relatorio_equipes(uuid, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_relatorio_equipes(uuid, date, date) FROM anon;