CREATE OR REPLACE FUNCTION public.reativar_base_lead_para_fila_ceo(p_base_lead_id uuid, p_template_name text DEFAULT NULL::text)
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
  v_emp_txt text;
  v_emp_canon_id uuid;
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

  -- Resolve o empreendimento pelo TEMPLATE do disparo (produto correto da campanha).
  v_emp_txt := NULL;
  IF v_tpl ILIKE '%casatua%' OR v_tpl ILIKE '%casa tua%' OR v_tpl ILIKE '%casa_tua%' THEN
    v_emp_txt := 'Casa Tua Porto Alegre';
  ELSIF v_tpl ILIKE '%vivid%' THEN
    v_emp_txt := 'Vivid Terrace';
  ELSIF v_tpl ILIKE '%flow%' THEN
    v_emp_txt := 'Flow';
  ELSIF v_tpl ILIKE '%lakebaical%' OR v_tpl ILIKE '%lake baical%' OR v_tpl ILIKE '%lakebaikal%' THEN
    v_emp_txt := 'Lake Baikal';
  ELSIF v_tpl ILIKE '%connectjw%' OR v_tpl ILIKE '%connect jw%' OR v_tpl ILIKE '%connect_jw%' THEN
    v_emp_txt := 'Connect JW';
  ELSIF v_tpl ILIKE '%atrio%' OR v_tpl ILIKE '%átrio%' THEN
    v_emp_txt := 'Átrio';
  END IF;

  v_emp_canon_id := NULL;
  IF COALESCE(trim(v_emp_txt), '') <> '' THEN
    SELECT ec.id INTO v_emp_canon_id
    FROM public.empreendimentos_canonicos ec
    WHERE ec.ativo = true AND lower(trim(ec.nome)) = lower(trim(v_emp_txt))
    LIMIT 1;

    IF v_emp_canon_id IS NULL THEN
      SELECT ea.empreendimento_id INTO v_emp_canon_id
      FROM public.empreendimento_aliases ea
      JOIN public.empreendimentos_canonicos ec2 ON ec2.id = ea.empreendimento_id
      WHERE ec2.ativo = true
        AND (lower(trim(ea.alias_raw)) = lower(trim(v_emp_txt))
             OR ea.alias_norm = lower(trim(v_emp_txt)))
      LIMIT 1;
    END IF;

    IF v_emp_canon_id IS NOT NULL THEN
      SELECT ec.nome INTO v_emp_txt FROM public.empreendimentos_canonicos ec WHERE ec.id = v_emp_canon_id;
    END IF;
  END IF;

  -- Template genérico: reaproveita o produto histórico do contato, se ainda ativo
  IF v_emp_canon_id IS NULL AND v_emp_txt IS NULL AND v_b.empreendimento_canonico_id IS NOT NULL THEN
    SELECT ec.id, ec.nome INTO v_emp_canon_id, v_emp_txt
    FROM public.empreendimentos_canonicos ec
    WHERE ec.id = v_b.empreendimento_canonico_id AND ec.ativo = true;
  END IF;

  IF v_emp_txt IS NULL THEN
    v_emp_txt := NULLIF(trim(v_b.empreendimento_texto), '');
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
    v_emp_txt,
    v_emp_canon_id,
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

CREATE OR REPLACE FUNCTION public.reativar_lead_para_fila_ceo(p_lead_id uuid, p_template_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_seg_moradia uuid := 'c8b24415-3dc1-4f65-aae1-f308ef02cb7a';
  v_seg_invest  uuid := 'dd96ad01-7e76-40e9-8324-211166168b26';
  v_seg_alto    uuid := '5e930c09-634d-40e1-9ccc-981b0a4eae74';
  v_seg_mcmv    uuid := '5311bbbb-0000-4000-8000-000000000003';
  v_stage_anterior uuid;
  v_movido_por uuid;
  v_origem_atual text;
  v_obs_atual text;
  v_nova_obs text;
  v_lead record;
  v_parcerias_canceladas int := 0;
  v_tarefas_canceladas int := 0;
  v_tpl text := COALESCE(NULLIF(trim(p_template_name), ''), 'reengajamento');
  v_is_casatua boolean;
  v_is_vivid boolean;
  v_is_lake boolean;
  v_is_atrio boolean;
  v_is_connectjw boolean;
  v_is_flow boolean;
  v_seg_id uuid;
  v_empreend text;
  v_foco_label text := NULL;
  v_emp_canon_id uuid;
BEGIN
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  END IF;

  v_is_casatua := v_tpl ILIKE '%casatua%' OR v_tpl ILIKE '%casa tua%' OR v_tpl ILIKE '%casa_tua%';
  v_is_vivid := v_tpl ILIKE '%vivid%';
  v_is_lake := v_tpl ILIKE '%lakebaical%' OR v_tpl ILIKE '%lake baical%' OR v_tpl ILIKE '%lakebaikal%';
  v_is_atrio := v_tpl ILIKE '%atrio%' OR v_tpl ILIKE '%átrio%';
  v_is_connectjw := v_tpl ILIKE '%connectjw%' OR v_tpl ILIKE '%connect jw%' OR v_tpl ILIKE '%connect_jw%';
  v_is_flow := v_tpl ILIKE '%flow%';

  IF v_is_casatua THEN
    v_seg_id := v_seg_moradia; v_empreend := 'Casa Tua Porto Alegre'; v_foco_label := 'Casa Tua Porto Alegre';
  ELSIF v_is_vivid THEN
    v_seg_id := v_seg_moradia; v_empreend := 'Vivid Terrace'; v_foco_label := 'Vivid Terrace';
  ELSIF v_is_flow THEN
    v_seg_id := v_seg_mcmv; v_empreend := 'Flow'; v_foco_label := 'Flow (MCMV)';
  ELSIF v_is_lake THEN
    v_seg_id := v_seg_alto; v_empreend := COALESCE(NULLIF(trim(v_lead.empreendimento), ''), 'Lake Baikal');
  ELSIF v_is_connectjw THEN
    v_seg_id := v_seg_invest; v_empreend := 'Connect JW'; v_foco_label := 'Connect JW (Investimento)';
  ELSIF v_is_atrio THEN
    v_seg_id := v_lead.segmento_id; v_empreend := COALESCE(NULLIF(trim(v_lead.empreendimento), ''), 'Átrio');
  ELSE
    v_seg_id := v_lead.segmento_id; v_empreend := v_lead.empreendimento;
  END IF;

  v_emp_canon_id := NULL;
  IF COALESCE(trim(v_empreend), '') <> '' THEN
    SELECT ec.id INTO v_emp_canon_id
    FROM public.empreendimentos_canonicos ec
    WHERE ec.ativo = true
      AND lower(trim(ec.nome)) = lower(trim(v_empreend))
    LIMIT 1;

    IF v_emp_canon_id IS NULL THEN
      SELECT ea.empreendimento_id INTO v_emp_canon_id
      FROM public.empreendimento_aliases ea
      JOIN public.empreendimentos_canonicos ec2 ON ec2.id = ea.empreendimento_id
      WHERE ec2.ativo = true
        AND (lower(trim(ea.alias_raw)) = lower(trim(v_empreend))
             OR ea.alias_norm = lower(trim(v_empreend)))
      LIMIT 1;
    END IF;
  END IF;

  IF v_emp_canon_id IS NULL AND v_lead.empreendimento_canonico_id IS NOT NULL THEN
    SELECT ec.id INTO v_emp_canon_id
    FROM public.empreendimentos_canonicos ec
    WHERE ec.id = v_lead.empreendimento_canonico_id
      AND ec.ativo = true
      AND lower(trim(ec.nome)) = lower(trim(COALESCE(v_empreend, '')))
    LIMIT 1;
  END IF;

  v_stage_anterior := v_lead.stage_id;
  v_origem_atual := COALESCE(v_lead.origem, 'não informada');
  v_obs_atual := COALESCE(v_lead.observacoes, '');
  v_movido_por := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  UPDATE public.pipeline_parcerias
     SET status = 'cancelada',
         motivo = concat_ws(' | ', nullif(motivo, ''), 'Cancelada: lead reengajado (template ' || v_tpl || ') → Fila do CEO'),
         updated_at = now()
   WHERE pipeline_lead_id = p_lead_id AND status = 'ativa';
  GET DIAGNOSTICS v_parcerias_canceladas = ROW_COUNT;

  UPDATE public.pipeline_tarefas
     SET status = 'cancelada',
         concluida_em = now(),
         descricao = COALESCE(descricao,'') || E'\n[Cancelada — lead reengajado (template ' || v_tpl || ') → Fila do CEO]',
         updated_at = now()
   WHERE pipeline_lead_id = p_lead_id
     AND status = 'pendente';
  GET DIAGNOSTICS v_tarefas_canceladas = ROW_COUNT;

  v_nova_obs := concat(
    '🔄 Lead reengajado pelo template "', v_tpl, '" em ',
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    ' — respondeu SIM. Enviado para a Fila do CEO (distribuição manual). Origem original: ', v_origem_atual, '.',
    CASE WHEN v_foco_label IS NOT NULL THEN ' Interesse atual: ' || v_foco_label || '.' ELSE '' END,
    CASE WHEN v_obs_atual <> '' THEN E'\n---\n' || v_obs_atual ELSE '' END
  );

  UPDATE public.pipeline_leads
     SET reengajamento_status = 'respondeu_sim',
         reativado_por_nutricao = true,
         reativado_em = now(),
         origem = 'Reengajamento',
         segmento_id = v_seg_id,
         empreendimento = v_empreend,
         empreendimento_canonico_id = v_emp_canon_id,
         stage_id = v_stage_novo_lead,
         stage_changed_at = now(),
         corretor_anterior_id = v_lead.corretor_id,
         corretor_id = NULL,
         aceite_status = 'pendente_distribuicao',
         aceite_expira_em = NULL,
         aceito_em = NULL,
         distribuido_em = NULL,
         tipo_descarte = NULL,
         motivo_descarte = NULL,
         arquivado = false,
         observacoes = v_nova_obs,
         updated_at = now()
   WHERE id = p_lead_id;

  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, v_stage_anterior, v_stage_novo_lead, v_movido_por,
    '🔄 LEAD REENGAJADO pelo template "' || v_tpl || '" — resposta positiva ao disparo. Enviado para a FILA DO CEO (distribuição manual).' ||
    CASE WHEN v_foco_label IS NOT NULL THEN ' Interesse atual: ' || v_foco_label || '.' ELSE '' END ||
    ' Origem original: ' || v_origem_atual ||
    '. ' || v_tarefas_canceladas || ' tarefa(s) pendente(s) cancelada(s).');

  RETURN jsonb_build_object(
    'success', true, 'lead_id', p_lead_id, 'destino', 'fila_ceo',
    'template', v_tpl,
    'segmento_foco', v_foco_label,
    'empreendimento', v_empreend,
    'empreendimento_canonico_id', v_emp_canon_id,
    'parcerias_canceladas', v_parcerias_canceladas,
    'tarefas_canceladas', v_tarefas_canceladas
  );
END;
$function$;