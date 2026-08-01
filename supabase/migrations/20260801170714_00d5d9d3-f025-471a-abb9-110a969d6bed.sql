-- 1) Aceitar base_lead na fila de disparos
ALTER TABLE public.reengajamento_dispatch_queue
  DROP CONSTRAINT IF EXISTS reengajamento_dispatch_queue_lead_ref_check;
ALTER TABLE public.reengajamento_dispatch_queue
  ADD CONSTRAINT reengajamento_dispatch_queue_lead_ref_check
  CHECK (lead_ref = ANY (ARRAY['pipeline_lead'::text,'oferta_ativa_lead'::text,'base_lead'::text]));

-- 2) Seleção de público da Base Única
CREATE OR REPLACE FUNCTION public.selecionar_reengajamento_base(
  p_filtro jsonb,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  email text,
  telefone_key text,
  empreendimento_texto text,
  empreendimento_canonico_id uuid,
  ultimo_formulario text,
  ultima_conversao_em timestamptz,
  situacao_crm text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads
    WHERE telefone_normalizado IS NOT NULL
      AND arquivado IS NOT TRUE
  ), oa AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads
    WHERE telefone_normalizado IS NOT NULL
      AND status IN ('na_fila','em_cooldown','aproveitado')
  ), jadisparado AS (
    SELECT DISTINCT q.phone_last8 AS k
    FROM reengajamento_dispatch_queue q
    WHERE q.status IN ('sent','processing','pending')
      AND q.created_at >= now() - make_interval(days => COALESCE((p_filtro->>'janela_dedup_dias')::int, 30))
      AND (
        nullif(p_filtro->>'template_name','') IS NULL
        OR q.template_name = p_filtro->>'template_name'
      )
  ), bruto AS (
    SELECT b.*,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM pipe WHERE pipe.k = b.telefone_key)) AS no_crm,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM oa WHERE oa.k = b.telefone_key)) AS na_oa,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM jadisparado j WHERE j.k = b.telefone_key)) AS ja_disparado
    FROM base_leads b
    WHERE b.opt_out = false
      AND b.telefone_key IS NOT NULL
      AND (
        p_filtro->'empreendimento_ids' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'empreendimento_ids','[]'::jsonb)) = 0
        OR b.empreendimento_canonico_id::text IN (SELECT jsonb_array_elements_text(p_filtro->'empreendimento_ids'))
      )
      AND (
        p_filtro->'formularios' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'formularios','[]'::jsonb)) = 0
        OR b.ultimo_formulario IN (SELECT jsonb_array_elements_text(p_filtro->'formularios'))
      )
      AND (
        p_filtro->'campanhas' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'campanhas','[]'::jsonb)) = 0
        OR b.campanha IN (SELECT jsonb_array_elements_text(p_filtro->'campanhas'))
      )
      AND (nullif(p_filtro->>'ano_min','') IS NULL OR extract(year from b.ultima_conversao_em) >= (p_filtro->>'ano_min')::int)
      AND (nullif(p_filtro->>'ano_max','') IS NULL OR extract(year from b.ultima_conversao_em) <= (p_filtro->>'ano_max')::int)
      AND (
        p_filtro->'situacao_crm' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'situacao_crm','[]'::jsonb)) = 0
        OR b.situacao_crm IN (SELECT jsonb_array_elements_text(p_filtro->'situacao_crm'))
      )
  )
  SELECT b.id, trim(concat_ws(' ', b.nome, b.sobrenome)) AS nome, b.telefone, b.email, b.telefone_key,
         b.empreendimento_texto, b.empreendimento_canonico_id, b.ultimo_formulario,
         b.ultima_conversao_em, b.situacao_crm
  FROM bruto b
  WHERE b.no_crm = false
    AND (COALESCE((p_filtro->>'excluir_oa')::boolean, true) = false OR b.na_oa = false)
    AND (COALESCE((p_filtro->>'excluir_ja_disparado')::boolean, true) = false OR b.ja_disparado = false)
  ORDER BY
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'antigos' THEN b.ultima_conversao_em END ASC NULLS LAST,
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'recentes' THEN b.ultima_conversao_em END DESC NULLS LAST,
    CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'aleatorio' THEN random() END
  LIMIT GREATEST(COALESCE(p_limit, 500), 0);
$function$;

GRANT EXECUTE ON FUNCTION public.selecionar_reengajamento_base(jsonb,int) TO authenticated, service_role;

-- 3) Prévia com funil de higiene
CREATE OR REPLACE FUNCTION public.preview_reengajamento_base(p_filtro jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH pipe AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM pipeline_leads
    WHERE telefone_normalizado IS NOT NULL AND arquivado IS NOT TRUE
  ), oa AS (
    SELECT DISTINCT right(telefone_normalizado, 8) AS k
    FROM oferta_ativa_leads
    WHERE telefone_normalizado IS NOT NULL
      AND status IN ('na_fila','em_cooldown','aproveitado')
  ), jadisparado AS (
    SELECT DISTINCT q.phone_last8 AS k
    FROM reengajamento_dispatch_queue q
    WHERE q.status IN ('sent','processing','pending')
      AND q.created_at >= now() - make_interval(days => COALESCE((p_filtro->>'janela_dedup_dias')::int, 30))
      AND (nullif(p_filtro->>'template_name','') IS NULL OR q.template_name = p_filtro->>'template_name')
  ), filtrado AS (
    SELECT b.*,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM pipe WHERE pipe.k = b.telefone_key)) AS no_crm,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM oa WHERE oa.k = b.telefone_key)) AS na_oa,
      (b.telefone_key IS NOT NULL AND EXISTS (SELECT 1 FROM jadisparado j WHERE j.k = b.telefone_key)) AS ja_disparado
    FROM base_leads b
    WHERE (
        p_filtro->'empreendimento_ids' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'empreendimento_ids','[]'::jsonb)) = 0
        OR b.empreendimento_canonico_id::text IN (SELECT jsonb_array_elements_text(p_filtro->'empreendimento_ids'))
      )
      AND (
        p_filtro->'formularios' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'formularios','[]'::jsonb)) = 0
        OR b.ultimo_formulario IN (SELECT jsonb_array_elements_text(p_filtro->'formularios'))
      )
      AND (
        p_filtro->'campanhas' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'campanhas','[]'::jsonb)) = 0
        OR b.campanha IN (SELECT jsonb_array_elements_text(p_filtro->'campanhas'))
      )
      AND (nullif(p_filtro->>'ano_min','') IS NULL OR extract(year from b.ultima_conversao_em) >= (p_filtro->>'ano_min')::int)
      AND (nullif(p_filtro->>'ano_max','') IS NULL OR extract(year from b.ultima_conversao_em) <= (p_filtro->>'ano_max')::int)
      AND (
        p_filtro->'situacao_crm' IS NULL
        OR jsonb_array_length(COALESCE(p_filtro->'situacao_crm','[]'::jsonb)) = 0
        OR b.situacao_crm IN (SELECT jsonb_array_elements_text(p_filtro->'situacao_crm'))
      )
  ), elegivel AS (
    SELECT * FROM filtrado
    WHERE opt_out = false
      AND telefone_key IS NOT NULL
      AND no_crm = false
      AND (COALESCE((p_filtro->>'excluir_oa')::boolean, true) = false OR na_oa = false)
      AND (COALESCE((p_filtro->>'excluir_ja_disparado')::boolean, true) = false OR ja_disparado = false)
  ), amostra AS (
    SELECT trim(concat_ws(' ', nome, sobrenome)) AS nome, telefone, email,
           empreendimento_texto, ultimo_formulario, ultima_conversao_em, situacao_crm
    FROM elegivel
    ORDER BY
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'antigos' THEN ultima_conversao_em END ASC NULLS LAST,
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'recentes' THEN ultima_conversao_em END DESC NULLS LAST,
      CASE WHEN COALESCE(p_filtro->>'ordem_selecao','recentes') = 'aleatorio' THEN random() END
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'bruto', (SELECT count(*)::int FROM filtrado),
    'total', (SELECT count(*)::int FROM elegivel),
    'removidos_opt_out', (SELECT count(*)::int FROM filtrado WHERE opt_out),
    'removidos_sem_telefone', (SELECT count(*)::int FROM filtrado WHERE opt_out = false AND telefone_key IS NULL),
    'removidos_crm', (SELECT count(*)::int FROM filtrado WHERE opt_out = false AND telefone_key IS NOT NULL AND no_crm),
    'removidos_oa', (SELECT count(*)::int FROM filtrado WHERE opt_out = false AND telefone_key IS NOT NULL AND no_crm = false AND na_oa),
    'removidos_ja_disparado', (SELECT count(*)::int FROM filtrado WHERE opt_out = false AND telefone_key IS NOT NULL AND no_crm = false AND na_oa = false AND ja_disparado),
    'amostra', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM amostra a), '[]'::jsonb)
  );
$function$;

GRANT EXECUTE ON FUNCTION public.preview_reengajamento_base(jsonb) TO authenticated, service_role;

-- 4) Reativação de contato da Base Única → Fila do CEO
CREATE OR REPLACE FUNCTION public.reativar_base_lead_para_fila_ceo(
  p_base_lead_id uuid,
  p_template_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_stage_descarte  uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_b record;
  v_tpl text := COALESCE(NULLIF(trim(p_template_name), ''), 'reengajamento');
  v_phone8 text;
  v_existing record;
  v_new_id uuid;
  v_obs text;
  v_nome text;
BEGIN
  SELECT * INTO v_b FROM public.base_leads WHERE id = p_base_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contato da Base Única não encontrado');
  END IF;

  v_nome := NULLIF(trim(concat_ws(' ', v_b.nome, v_b.sobrenome)), '');
  v_phone8 := right(regexp_replace(COALESCE(NULLIF(v_b.telefone_normalizado,''), v_b.telefone, ''), '[^0-9]', '', 'g'), 8);

  IF v_phone8 IS NOT NULL AND length(v_phone8) = 8 THEN
    SELECT id, nome, arquivado, stage_id, motivo_descarte, corretor_id
      INTO v_existing
    FROM public.pipeline_leads
    WHERE right(regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g'), 8) = v_phone8
    ORDER BY (NOT arquivado) DESC, updated_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.arquivado IS NOT TRUE
         AND v_existing.stage_id IS DISTINCT FROM v_stage_descarte
         AND v_existing.motivo_descarte IS NULL THEN
        UPDATE public.pipeline_leads
           SET reengajamento_status = 'respondeu_sim', updated_at = now()
         WHERE id = v_existing.id;

        INSERT INTO public.pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, status, responsavel_id)
        VALUES (v_existing.id, 'whatsapp',
          '🔥 Interesse confirmado (Base Única) — template ' || v_tpl,
          'Contato respondeu SIM ao template "' || v_tpl || '" (origem: Base Única de Leads). Já está ATIVO no pipeline — mantido com o corretor atual.',
          (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'concluida', v_existing.corretor_id);

        UPDATE public.base_leads
           SET situacao_crm = 'no_pipeline', pipeline_lead_id = v_existing.id, updated_at = now()
         WHERE id = p_base_lead_id;

        RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true, 'already_active', true, 'corretor_id', v_existing.corretor_id);
      END IF;

      PERFORM public.reativar_lead_para_fila_ceo(v_existing.id, v_tpl);
      UPDATE public.base_leads
         SET situacao_crm = 'no_pipeline', pipeline_lead_id = v_existing.id, updated_at = now()
       WHERE id = p_base_lead_id;
      RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true, 'already_active', false);
    END IF;
  END IF;

  v_obs := concat(
    '🔄 Contato reengajado pelo template "', v_tpl, '" em ',
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    ' — respondeu SIM (origem: Base Única / ', COALESCE(NULLIF(v_b.empreendimento_texto,''), 'sem produto'),
    '). Enviado para a Fila do CEO (distribuição manual).'
  );

  INSERT INTO public.pipeline_leads (
    nome, telefone, email, empreendimento, empreendimento_canonico_id, origem,
    stage_id, stage_changed_at, aceite_status, aceite_expira_em,
    reativado_por_nutricao, reativado_em, reengajamento_status,
    prioridade_lead, arquivado, observacoes
  ) VALUES (
    COALESCE(v_nome, 'Lead Base Única'),
    v_b.telefone,
    NULLIF(trim(v_b.email),''),
    NULLIF(trim(v_b.empreendimento_texto),''),
    v_b.empreendimento_canonico_id,
    'Reengajamento',
    v_stage_novo_lead, now(), 'pendente_distribuicao', NULL,
    true, now(), 'respondeu_sim',
    'media', false, v_obs
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (v_new_id, NULL, v_stage_novo_lead, '00000000-0000-0000-0000-000000000000'::uuid,
          'Lead criado a partir da Base Única (respondeu SIM ao template ' || v_tpl || ') → Fila do CEO');

  UPDATE public.base_leads
     SET situacao_crm = 'no_pipeline', pipeline_lead_id = v_new_id, updated_at = now()
   WHERE id = p_base_lead_id;

  RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_new_id, 'reused', false, 'already_active', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reativar_base_lead_para_fila_ceo(uuid,text) TO authenticated, service_role;