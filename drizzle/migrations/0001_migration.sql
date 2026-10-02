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
  v_emp_mudou boolean := false;
BEGIN
  SELECT * INTO v_b FROM public.base_leads WHERE id = p_base_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contato da Base Única não encontrado');
  END IF;

  v_nome := NULLIF(trim(concat_ws(' ', v_b.nome, v_b.sobrenome)), '');
  v_phone8 := right(regexp_replace(COALESCE(NULLIF(v_b.telefone_normalizado,''), v_b.telefone, ''), '[^0-9]', '', 'g'), 8);

  v_emp_txt := NULL;
  IF v_tpl ILIKE '%openbosque%' OR v_tpl ILIKE '%open_bosque%' OR v_tpl ILIKE '%open bosque%' THEN
    v_emp_txt := 'Open Bosque';
  ELSIF v_tpl ILIKE '%canoas%' THEN
    v_emp_txt := 'Casa Tua Canoas';
  ELSIF v_tpl ILIKE '%casatua%' OR v_tpl ILIKE '%casa tua%' OR v_tpl ILIKE '%casa_tua%' THEN
    v_emp_txt := 'Casa Tua Porto Alegre';
  ELSIF v_tpl ILIKE '%vivid%' THEN
    v_emp_txt := 'Vivid Terrace';
  ELSIF v_tpl ILIKE '%flow%' THEN
    v_emp_txt := 'Flow';
  ELSIF v_tpl ILIKE '%lakebaical%' OR v_tpl ILIKE '%lake baical%' OR v_tpl ILIKE '%lakebaikal%' THEN
    v_emp_txt := 'Lake Baikal';
  ELSIF v_tpl ILIKE '%connectjw%' OR v_tpl ILIKE '%connect jw%' OR v_tpl ILIKE '%connect_jw%' THEN
    v_emp_txt := 'Connect JW';
  ELSIF v_tpl ~* '(^|[^a-z])awa([^a-z]|$)' THEN
    v_emp_txt := 'AWA';
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

  IF v_phone8 IS NOT NULL AND length(v_phone8) = 8 THEN
    SELECT id, nome, arquivado, stage_id, motivo_descarte, corretor_id, empreendimento, observacoes
      INTO v_existing
    FROM public.pipeline_leads
    WHERE right(regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g'), 8) = v_phone8
    ORDER BY (NOT arquivado) DESC, updated_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.arquivado IS NOT TRUE
         AND v_existing.stage_id IS DISTINCT FROM v_stage_descarte
         AND v_existing.motivo_descarte IS NULL THEN

        v_emp_mudou := COALESCE(trim(v_emp_txt),'') <> ''
                       AND lower(trim(v_emp_txt)) IS DISTINCT FROM lower(trim(COALESCE(v_existing.empreendimento,'')));

        IF v_emp_mudou THEN
          UPDATE public.pipeline_leads
             SET reengajamento_status = 'respondeu_sim',
                 empreendimento = v_emp_txt,
                 campanha = v_emp_txt,
                 formulario = NULL,
                 conjunto_anuncio = NULL,
                 anuncio = NULL,
                 origem_detalhe = 'Reengajamento ' || v_tpl,
                 observacoes = concat(
                   '[NOVO INTERESSE ', to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI'), '] ',
                   v_emp_txt, ' (reengajamento — template ', v_tpl, ')',
                   CASE WHEN COALESCE(trim(v_existing.empreendimento),'') <> ''
                        THEN ' — antes: ' || v_existing.empreendimento ELSE '' END,
                   CASE WHEN COALESCE(trim(v_existing.observacoes),'') <> ''
                        THEN E'\n---\n' || v_existing.observacoes ELSE '' END
                 ),
                 updated_at = now()
           WHERE id = v_existing.id;
        ELSE
          UPDATE public.pipeline_leads
             SET reengajamento_status = 'respondeu_sim', updated_at = now()
           WHERE id = v_existing.id;
        END IF;

        INSERT INTO public.pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, status, responsavel_id, created_by)
        VALUES (v_existing.id, 'whatsapp',
          '🔥 Interesse confirmado (Base Única) — template ' || v_tpl,
          'Contato respondeu SIM ao template "' || v_tpl || '" (origem: Base Única de Leads). Já está ATIVO no pipeline — mantido com o corretor atual.' ||
          CASE WHEN v_emp_mudou THEN ' NOVO INTERESSE: ' || v_emp_txt ||
               CASE WHEN COALESCE(trim(v_existing.empreendimento),'') <> '' THEN ' (antes: ' || v_existing.empreendimento || ')' ELSE '' END || '.'
               ELSE '' END,
          (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'concluida', v_existing.corretor_id,
          '00000000-0000-0000-0000-000000000000'::uuid);

        UPDATE public.base_leads
           SET situacao_crm = 'no_pipeline', pipeline_lead_id = v_existing.id, updated_at = now()
         WHERE id = p_base_lead_id;

        RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true, 'already_active', true, 'corretor_id', v_existing.corretor_id, 'empreendimento_atualizado', v_emp_mudou);
      END IF;

      PERFORM public.reativar_lead_para_fila_ceo(v_existing.id, v_tpl);
      UPDATE public.base_leads
         SET situacao_crm = 'no_pipeline', pipeline_lead_id = v_existing.id, updated_at = now()
       WHERE id = p_base_lead_id;
      RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true, 'already_active', false);
    END IF;
  END IF;

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
    nome, telefone, email, empreendimento, campanha, origem_detalhe, origem,
    stage_id, stage_changed_at, aceite_status, aceite_expira_em,
    reativado_por_nutricao, reativado_em, reengajamento_status,
    prioridade_lead, arquivado, observacoes
  ) VALUES (
    COALESCE(v_nome, 'Lead Base Única'),
    v_b.telefone,
    NULLIF(trim(v_b.email),''),
    v_emp_txt,
    v_emp_txt,
    'Reengajamento ' || v_tpl,
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