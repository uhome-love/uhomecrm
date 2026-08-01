ALTER TABLE public.oferta_ativa_listas
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS ordem_selecao text NOT NULL DEFAULT 'recentes',
  ADD COLUMN IF NOT EXISTS escopo jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.preview_campanha_da_base_v2(p_filtro jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH sel AS (
    SELECT b.id, b.nome, b.sobrenome, b.telefone, b.email,
           b.empreendimento_texto, b.ultimo_formulario, b.ultima_conversao_em, b.situacao_crm
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
      AND (nullif(p_filtro->>'situacao','') IS NULL OR b.situacao_crm = p_filtro->>'situacao')
      AND (NOT coalesce((p_filtro->>'nunca_trabalhado')::boolean, true) OR b.vezes_trabalhado = 0)
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
    'amostra', coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM amostra a), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.criar_campanha_da_base_v2(p_nome text, p_filtro jsonb, p_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_situacao text := nullif(p_filtro->>'situacao','');
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

  WITH sel AS (
    SELECT b.* FROM base_leads b
    WHERE b.opt_out = false
      AND b.produto_extinto = false
      AND (NOT v_com_tel OR b.telefone_key IS NOT NULL)
      AND (NOT v_com_email OR nullif(trim(b.email),'') IS NOT NULL)
      AND (v_emp_ids IS NULL OR b.empreendimento_canonico_id = ANY(v_emp_ids))
      AND (v_forms IS NULL OR b.ultimo_formulario = ANY(v_forms))
      AND (v_ano_min IS NULL OR extract(year from b.ultima_conversao_em) >= v_ano_min)
      AND (v_ano_max IS NULL OR extract(year from b.ultima_conversao_em) <= v_ano_max)
      AND (v_situacao IS NULL OR b.situacao_crm = v_situacao)
      AND (NOT v_nunca_trab OR b.vezes_trabalhado = 0)
      AND NOT EXISTS (
        SELECT 1 FROM oferta_ativa_leads o
        WHERE o.telefone_normalizado IS NOT NULL
          AND b.telefone_key IS NOT NULL
          AND right(o.telefone_normalizado, 8) = b.telefone_key
          AND o.status IN ('na_fila','em_cooldown','aproveitado')
      )
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
END; $function$;