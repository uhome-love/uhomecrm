CREATE OR REPLACE FUNCTION public.base_reengajamento_candidatos(p_filtro jsonb)
RETURNS TABLE(
  id uuid,
  nome text,
  telefone text,
  email text,
  telefone_key text,
  empreendimento_texto text,
  ultimo_formulario text,
  ultima_conversao_em timestamptz,
  situacao_crm text,
  f_opt_out boolean,
  f_sem_telefone boolean,
  f_pipeline_ativo boolean,
  f_ganho boolean,
  f_descartado boolean,
  f_oferta_ativa boolean,
  f_ja_disparado boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH crm AS (
    SELECT right(pl.telefone_normalizado, 8) AS k,
      bool_or(pl.stage_id NOT IN (
        '1dd66c25-3848-4053-9f66-82e902989b4d'::uuid,
        '43997e74-aa71-4796-b7d0-11abae2d49ac'::uuid,
        '2d7739eb-1787-4ad6-887a-7a4a32dcfc05'::uuid
      )) AS ativo,
      bool_or(pl.stage_id = '2d7739eb-1787-4ad6-887a-7a4a32dcfc05'::uuid) AS ganho,
      bool_or(pl.stage_id IN (
        '1dd66c25-3848-4053-9f66-82e902989b4d'::uuid,
        '43997e74-aa71-4796-b7d0-11abae2d49ac'::uuid
      )) AS descartado
    FROM pipeline_leads pl
    WHERE pl.telefone_normalizado IS NOT NULL
      AND pl.arquivado IS NOT TRUE
    GROUP BY 1
  ), oa AS (
    SELECT DISTINCT right(o.telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads o
    WHERE o.telefone_normalizado IS NOT NULL
      AND o.status IN ('na_fila','em_cooldown','aproveitado')
  ), jadisparado AS (
    SELECT DISTINCT q.phone_last8 AS k
    FROM reengajamento_dispatch_queue q
    WHERE q.status IN ('sent','processing','pending')
      AND q.created_at >= now() - make_interval(days => COALESCE((p_filtro->>'janela_dedup_dias')::int, 30))
      AND (nullif(p_filtro->>'template_name','') IS NULL OR q.template_name = p_filtro->>'template_name')
  )
  SELECT
    b.id,
    trim(concat_ws(' ', b.nome, b.sobrenome)) AS nome,
    b.telefone,
    b.email,
    b.telefone_key,
    b.empreendimento_texto,
    b.ultimo_formulario,
    b.ultima_conversao_em,
    b.situacao_crm,
    b.opt_out AS f_opt_out,
    (b.telefone_key IS NULL) AS f_sem_telefone,
    COALESCE(c.ativo, false) AS f_pipeline_ativo,
    COALESCE(c.ganho, false) AS f_ganho,
    COALESCE(c.descartado, false) AS f_descartado,
    (oa.k IS NOT NULL) AS f_oferta_ativa,
    (j.k IS NOT NULL) AS f_ja_disparado
  FROM base_leads b
  LEFT JOIN crm c ON b.telefone_key IS NOT NULL AND c.k = b.telefone_key
  LEFT JOIN oa ON b.telefone_key IS NOT NULL AND oa.k = b.telefone_key
  LEFT JOIN jadisparado j ON b.telefone_key IS NOT NULL AND j.k = b.telefone_key
  WHERE (
      jsonb_array_length(COALESCE(p_filtro->'empreendimento_ids','[]'::jsonb)) = 0
      OR b.empreendimento_canonico_id::text IN (SELECT jsonb_array_elements_text(p_filtro->'empreendimento_ids'))
    )
    AND (
      jsonb_array_length(COALESCE(p_filtro->'formularios','[]'::jsonb)) = 0
      OR b.ultimo_formulario IN (SELECT jsonb_array_elements_text(p_filtro->'formularios'))
    )
    AND (
      jsonb_array_length(COALESCE(p_filtro->'campanhas','[]'::jsonb)) = 0
      OR b.campanha IN (SELECT jsonb_array_elements_text(p_filtro->'campanhas'))
    )
    AND (
      jsonb_array_length(COALESCE(p_filtro->'situacao_crm','[]'::jsonb)) = 0
      OR b.situacao_crm IN (SELECT jsonb_array_elements_text(p_filtro->'situacao_crm'))
    )
    AND (nullif(p_filtro->>'ano_min','') IS NULL OR extract(year from b.ultima_conversao_em) >= (p_filtro->>'ano_min')::int)
    AND (nullif(p_filtro->>'ano_max','') IS NULL OR extract(year from b.ultima_conversao_em) <= (p_filtro->>'ano_max')::int)
$function$;

GRANT EXECUTE ON FUNCTION public.base_reengajamento_candidatos(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.preview_reengajamento_base(p_filtro jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cand AS (
    SELECT * FROM base_reengajamento_candidatos(p_filtro)
  ), flags AS (
    SELECT
      COALESCE((p_filtro->>'excluir_pipeline_ativo')::boolean, true) AS ex_pipe,
      COALESCE((p_filtro->>'excluir_ganho')::boolean, true) AS ex_ganho,
      COALESCE((p_filtro->>'excluir_descartados')::boolean, false) AS ex_desc,
      COALESCE((p_filtro->>'excluir_oa')::boolean, true) AS ex_oa,
      COALESCE((p_filtro->>'excluir_ja_disparado')::boolean, true) AS ex_disp
  ), passo AS (
    SELECT c.*,
      (NOT c.f_opt_out) AS p1,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone) AS p2,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone
        AND NOT (f.ex_pipe AND c.f_pipeline_ativo)) AS p3,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone
        AND NOT (f.ex_pipe AND c.f_pipeline_ativo)
        AND NOT (f.ex_ganho AND c.f_ganho)) AS p4,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone
        AND NOT (f.ex_pipe AND c.f_pipeline_ativo)
        AND NOT (f.ex_ganho AND c.f_ganho)
        AND NOT (f.ex_desc AND c.f_descartado)) AS p5,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone
        AND NOT (f.ex_pipe AND c.f_pipeline_ativo)
        AND NOT (f.ex_ganho AND c.f_ganho)
        AND NOT (f.ex_desc AND c.f_descartado)
        AND NOT (f.ex_oa AND c.f_oferta_ativa)) AS p6,
      (NOT c.f_opt_out AND NOT c.f_sem_telefone
        AND NOT (f.ex_pipe AND c.f_pipeline_ativo)
        AND NOT (f.ex_ganho AND c.f_ganho)
        AND NOT (f.ex_desc AND c.f_descartado)
        AND NOT (f.ex_oa AND c.f_oferta_ativa)
        AND NOT (f.ex_disp AND c.f_ja_disparado)) AS p7
    FROM cand c CROSS JOIN flags f
  ), amostra AS (
    SELECT nome, telefone, email, empreendimento_texto, ultimo_formulario, ultima_conversao_em, situacao_crm
    FROM passo WHERE p7
    ORDER BY
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'antigos' THEN ultima_conversao_em END ASC NULLS LAST,
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'recentes' THEN ultima_conversao_em END DESC NULLS LAST,
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'aleatorio' THEN random() END
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'bruto', (SELECT count(*)::int FROM passo),
    'total', (SELECT count(*)::int FROM passo WHERE p7),
    'removidos_opt_out', (SELECT count(*)::int FROM passo WHERE NOT p1),
    'removidos_sem_telefone', (SELECT count(*)::int FROM passo WHERE p1 AND NOT p2),
    'removidos_pipeline_ativo', (SELECT count(*)::int FROM passo WHERE p2 AND NOT p3),
    'removidos_ganho', (SELECT count(*)::int FROM passo WHERE p3 AND NOT p4),
    'removidos_descartados', (SELECT count(*)::int FROM passo WHERE p4 AND NOT p5),
    'removidos_oa', (SELECT count(*)::int FROM passo WHERE p5 AND NOT p6),
    'removidos_ja_disparado', (SELECT count(*)::int FROM passo WHERE p6 AND NOT p7),
    'mantidos_pipeline_ativo', (SELECT count(*)::int FROM passo WHERE p7 AND f_pipeline_ativo),
    'mantidos_ganho', (SELECT count(*)::int FROM passo WHERE p7 AND f_ganho),
    'mantidos_descartados', (SELECT count(*)::int FROM passo WHERE p7 AND f_descartado),
    'removidos_crm', (SELECT count(*)::int FROM passo WHERE p2 AND NOT p5),
    'amostra', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM amostra a), '[]'::jsonb)
  );
$function$;

DROP FUNCTION IF EXISTS public.selecionar_reengajamento_base(jsonb, integer);
CREATE OR REPLACE FUNCTION public.selecionar_reengajamento_base(p_filtro jsonb, p_limit integer DEFAULT 500)
RETURNS TABLE(id uuid, nome text, telefone text, email text, empreendimento_texto text, ultimo_formulario text, ultima_conversao_em timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome, c.telefone, c.email, c.empreendimento_texto, c.ultimo_formulario, c.ultima_conversao_em
  FROM base_reengajamento_candidatos(p_filtro) c
  WHERE c.f_opt_out = false
    AND c.f_sem_telefone = false
    AND NOT (COALESCE((p_filtro->>'excluir_pipeline_ativo')::boolean, true) AND c.f_pipeline_ativo)
    AND NOT (COALESCE((p_filtro->>'excluir_ganho')::boolean, true) AND c.f_ganho)
    AND NOT (COALESCE((p_filtro->>'excluir_descartados')::boolean, false) AND c.f_descartado)
    AND NOT (COALESCE((p_filtro->>'excluir_oa')::boolean, true) AND c.f_oferta_ativa)
    AND NOT (COALESCE((p_filtro->>'excluir_ja_disparado')::boolean, true) AND c.f_ja_disparado)
  ORDER BY
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'antigos' THEN c.ultima_conversao_em END ASC NULLS LAST,
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'recentes' THEN c.ultima_conversao_em END DESC NULLS LAST,
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'aleatorio' THEN random() END
  LIMIT GREATEST(COALESCE(p_limit, 500), 1)
$function$;

GRANT EXECUTE ON FUNCTION public.preview_reengajamento_base(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.selecionar_reengajamento_base(jsonb, integer) TO authenticated, service_role;