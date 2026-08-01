CREATE OR REPLACE FUNCTION public.preview_campanha_da_base_v2(p_filtro jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads
    WHERE telefone_normalizado IS NOT NULL
  ), pipe_mail AS (
    SELECT DISTINCT lower(trim(email)) AS m
    FROM pipeline_leads
    WHERE nullif(trim(email),'') IS NOT NULL
  ), oa AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads
    WHERE telefone_normalizado IS NOT NULL
      AND status IN ('na_fila','em_cooldown','aproveitado')
  ), bruto AS (
    SELECT b.id, b.nome, b.sobrenome, b.telefone, b.email,
           b.empreendimento_texto, b.ultimo_formulario, b.ultima_conversao_em, b.situacao_crm,
           b.telefone_key,
           (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM pipe WHERE pipe.k = b.telefone_key))
             OR (nullif(trim(b.email),'') IS NOT NULL AND EXISTS (SELECT 1 FROM pipe_mail WHERE pipe_mail.m = lower(trim(b.email)))) AS no_crm,
           (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM oa WHERE oa.k = b.telefone_key)) AS na_oa
    FROM base_leads b
    WHERE b.opt_out = false
      AND b.produto_extinto = false
      AND (NOT coalesce((p_filtro->>'com_telefone')::boolean, true) OR b.telefone_key IS NOT NULL)
      AND (NOT coalesce((p_filtro->>'com_email')::boolean, false) OR nullif(trim(b.email),'') IS NOT NULL)
      AND (
        p_filtro->'empreendimento_ids' IS NULL
        OR jsonb_array_length(coalesce(p_filtro->'empreendimento_ids','[]'::jsonb)) = 0
        OR b.empreendimento_canonico_id::text IN (
             SELECT jsonb_array_elements_text(p_filtro->'empreendimento_ids'))
      )
      AND (
        p_filtro->'formularios' IS NULL
        OR jsonb_array_length(coalesce(p_filtro->'formularios','[]'::jsonb)) = 0
        OR b.ultimo_formulario IN (SELECT jsonb_array_elements_text(p_filtro->'formularios'))
      )
      AND (nullif(p_filtro->>'ano_min','') IS NULL OR extract(year from b.ultima_conversao_em) >= (p_filtro->>'ano_min')::int)
      AND (nullif(p_filtro->>'ano_max','') IS NULL OR extract(year from b.ultima_conversao_em) <= (p_filtro->>'ano_max')::int)
      AND (NOT coalesce((p_filtro->>'nunca_trabalhado')::boolean, true) OR b.vezes_trabalhado = 0)
  ), sel AS (
    SELECT id, nome, sobrenome, telefone, email, empreendimento_texto,
           ultimo_formulario, ultima_conversao_em, situacao_crm
    FROM bruto WHERE no_crm = false AND na_oa = false
  ), amostra AS (
    SELECT * FROM sel
    ORDER BY
      CASE WHEN coalesce(p_filtro->>'ordem_selecao','recentes') = 'antigos' THEN ultima_conversao_em END ASC NULLS LAST,
      CASE WHEN coalesce(p_filtro->>'ordem_selecao','recentes') = 'recentes' THEN ultima_conversao_em END DESC NULLS LAST,
      CASE WHEN coalesce(p_filtro->>'ordem_selecao','recentes') = 'aleatorio' THEN random() END
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::int FROM sel),
    'bruto', (SELECT count(*)::int FROM bruto),
    'removidos_crm', (SELECT count(*)::int FROM bruto WHERE no_crm),
    'removidos_oa', (SELECT count(*)::int FROM bruto WHERE no_crm = false AND na_oa),
    'amostra', coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM amostra a), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.criar_campanha_da_base_v2(p_nome text, p_filtro jsonb, p_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_lista_id uuid;
  v_uid uuid := auth.uid();
  v_emp_ids uuid[] := CASE
    WHEN jsonb_array_length(coalesce(p_filtro->'empreendimento_ids','[]'::jsonb)) = 0 THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(p_filtro->'empreendimento_ids')::uuid) END;
  v_forms text[] := CASE
    WHEN jsonb_array_length(coalesce(p_filtro->'formularios','[]'::jsonb)) = 0 THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(p_filtro->'formularios')) END;
  v_ano_min int := nullif(p_filtro->>'ano_min','')::int;
  v_ano_max int := nullif(p_filtro->>'ano_max','')::int;
  v_nunca_trab boolean := coalesce((p_filtro->>'nunca_trabalhado')::boolean, true);
  v_com_tel boolean := coalesce((p_filtro->>'com_telefone')::boolean, true);
  v_com_email boolean := coalesce((p_filtro->>'com_email')::boolean, false);
  v_ordem text := coalesce(p_config->>'ordem_selecao','recentes');
  v_limite int := greatest(coalesce((p_config->>'limite')::int, 500), 1);
  v_expira timestamptz := (p_config->>'expira_em')::timestamptz;
  v_liberar boolean := coalesce((p_config->>'liberar')::boolean, true);
  v_emp_nome text;
  v_qtd int := 0;
BEGIN
  IF NOT (has_role(v_uid,'admin') OR has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Sem permissão para criar campanha';
  END IF;

  IF v_emp_ids IS NOT NULL AND array_length(v_emp_ids,1) = 1 THEN
    SELECT nome INTO v_emp_nome FROM empreendimentos_canonicos WHERE id = v_emp_ids[1];
  END IF;

  INSERT INTO oferta_ativa_listas (nome, empreendimento, empreendimento_canonico_id, origem, status,
    criado_por, filtro, origem_base, liberada_em, expira_em, tipo,
    observacao, template_id, ordem_selecao, escopo, max_tentativas, cooldown_dias)
  VALUES (p_nome, coalesce(v_emp_nome,'Base Única'),
    CASE WHEN v_emp_ids IS NOT NULL AND array_length(v_emp_ids,1) = 1 THEN v_emp_ids[1] END,
    'base_unica',
    CASE WHEN v_liberar THEN 'liberada' ELSE 'pendente' END,
    v_uid, p_filtro || jsonb_build_object('ordem_selecao', v_ordem), true,
    CASE WHEN v_liberar THEN now() END, v_expira, 'empreendimento',
    nullif(p_config->>'observacao',''), nullif(p_config->>'template_id','')::uuid, v_ordem,
    coalesce(p_config->'escopo','{}'::jsonb),
    coalesce((p_config->>'max_tentativas')::int, 3),
    coalesce((p_config->>'cooldown_dias')::int, 30))
  RETURNING id INTO v_lista_id;

  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads WHERE telefone_normalizado IS NOT NULL
  ), pipe_mail AS (
    SELECT DISTINCT lower(trim(email)) AS m
    FROM pipeline_leads WHERE nullif(trim(email),'') IS NOT NULL
  ), oa AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads
    WHERE telefone_normalizado IS NOT NULL
      AND status IN ('na_fila','em_cooldown','aproveitado')
  ), sel AS (
    SELECT b.* FROM base_leads b
    WHERE b.opt_out = false
      AND b.produto_extinto = false
      AND (NOT v_com_tel OR b.telefone_key IS NOT NULL)
      AND (NOT v_com_email OR nullif(trim(b.email),'') IS NOT NULL)
      AND (v_emp_ids IS NULL OR b.empreendimento_canonico_id = ANY(v_emp_ids))
      AND (v_forms IS NULL OR b.ultimo_formulario = ANY(v_forms))
      AND (v_ano_min IS NULL OR extract(year from b.ultima_conversao_em) >= v_ano_min)
      AND (v_ano_max IS NULL OR extract(year from b.ultima_conversao_em) <= v_ano_max)
      AND (NOT v_nunca_trab OR b.vezes_trabalhado = 0)
      -- Higiene obrigatória: nunca liberar quem já existe no pipeline (ativo,
      -- descartado ou arquivado) nem quem está em fila de Oferta Ativa.
      AND NOT (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM pipe WHERE pipe.k = b.telefone_key))
      AND NOT (nullif(trim(b.email),'') IS NOT NULL AND EXISTS (SELECT 1 FROM pipe_mail WHERE pipe_mail.m = lower(trim(b.email))))
      AND NOT (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM oa WHERE oa.k = b.telefone_key))
    ORDER BY
      CASE WHEN v_ordem = 'antigos' THEN b.ultima_conversao_em END ASC NULLS LAST,
      CASE WHEN v_ordem = 'recentes' THEN b.ultima_conversao_em END DESC NULLS LAST,
      CASE WHEN v_ordem = 'aleatorio' THEN random() END
    LIMIT v_limite
  ), ins AS (
    INSERT INTO oferta_ativa_leads (lista_id, base_lead_id, nome, telefone, telefone_normalizado, email,
      empreendimento, campanha, origem, data_lead, status)
    SELECT v_lista_id, s.id, coalesce(nullif(trim(coalesce(s.nome,'') || ' ' || coalesce(s.sobrenome,'')),''),'Sem nome'),
      s.telefone, s.telefone_normalizado, s.email,
      coalesce(v_emp_nome, s.empreendimento_texto), p_nome, 'base_unica',
      s.ultima_conversao_em::date, 'na_fila'
    FROM sel s
    RETURNING base_lead_id
  )
  SELECT count(*) INTO v_qtd FROM ins;

  UPDATE base_leads b SET vezes_trabalhado = b.vezes_trabalhado + 1,
    ultima_campanha_oa_id = v_lista_id, ultima_liberacao_em = now()
  WHERE b.id IN (SELECT base_lead_id FROM oferta_ativa_leads WHERE lista_id = v_lista_id AND base_lead_id IS NOT NULL);

  UPDATE oferta_ativa_listas SET total_leads = v_qtd WHERE id = v_lista_id;

  RETURN jsonb_build_object('ok', true, 'lista_id', v_lista_id, 'total', v_qtd);
END;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_situacao_crm_base_leads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_alterados int := 0;
BEGIN
  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads WHERE telefone_normalizado IS NOT NULL
  ), oa AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads WHERE telefone_normalizado IS NOT NULL
  ), calc AS (
    SELECT b.id,
      CASE
        WHEN p.k IS NOT NULL AND o.k IS NOT NULL THEN 'ambos'
        WHEN p.k IS NOT NULL THEN 'no_pipeline'
        WHEN o.k IS NOT NULL THEN 'na_oferta_ativa'
        ELSE 'inedito'
      END AS nova
    FROM base_leads b
    LEFT JOIN pipe p ON p.k = b.telefone_key
    LEFT JOIN oa o ON o.k = b.telefone_key
  )
  UPDATE base_leads b SET situacao_crm = c.nova
  FROM calc c
  WHERE c.id = b.id AND b.situacao_crm IS DISTINCT FROM c.nova;

  GET DIAGNOSTICS v_alterados = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'atualizados', v_alterados);
END;
$function$;