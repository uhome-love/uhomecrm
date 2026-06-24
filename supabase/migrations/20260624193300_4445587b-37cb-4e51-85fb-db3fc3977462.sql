CREATE OR REPLACE FUNCTION public.reativar_oferta_ativa_para_fila_ceo(
  p_oa_lead_id uuid,
  p_template_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_stage_descarte uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
  v_oa record;
  v_tpl text := COALESCE(NULLIF(trim(p_template_name), ''), 'reengajamento');
  v_is_casatua boolean;
  v_is_vivid boolean;
  v_empreend text;
  v_foco_label text := NULL;
  v_phone8 text;
  v_existing record;
  v_new_id uuid;
  v_obs text;
BEGIN
  SELECT * INTO v_oa FROM public.oferta_ativa_leads WHERE id = p_oa_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead Oferta Ativa não encontrado');
  END IF;

  v_is_casatua := v_tpl ILIKE '%casatua%' OR v_tpl ILIKE '%casa tua%' OR v_tpl ILIKE '%casa_tua%';
  v_is_vivid := v_tpl ILIKE '%vivid%';

  IF v_is_casatua THEN
    v_empreend := 'Casa Tua';
    v_foco_label := 'Casa Tua (FOCO)';
  ELSIF v_is_vivid THEN
    v_empreend := 'Vivid Terrace';
    v_foco_label := 'Vivid Terrace (Produto Foco)';
  ELSE
    v_empreend := NULLIF(trim(v_oa.empreendimento), '');
  END IF;

  -- Telefone normalizado (últimos 8 dígitos) para dedup com pipeline
  v_phone8 := right(regexp_replace(COALESCE(NULLIF(v_oa.telefone_normalizado,''), v_oa.telefone, ''), '[^0-9]', '', 'g'), 8);

  -- SEMPRE verificar se já existe lead no pipeline com este telefone ANTES de criar.
  IF v_phone8 IS NOT NULL AND length(v_phone8) = 8 THEN
    SELECT id, nome, arquivado, stage_id, motivo_descarte, corretor_id
      INTO v_existing
    FROM public.pipeline_leads
    WHERE right(regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g'), 8) = v_phone8
    ORDER BY (NOT arquivado) DESC, updated_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Lead ATIVO no pipeline (não arquivado, fora do descarte, sem motivo de descarte):
      -- respeita exclusividade — NÃO arranca pra Fila do CEO, mantém com o corretor atual.
      IF v_existing.arquivado IS NOT TRUE
         AND v_existing.stage_id IS DISTINCT FROM v_stage_descarte
         AND v_existing.motivo_descarte IS NULL THEN
        UPDATE public.oferta_ativa_leads
           SET status = 'reativado', updated_at = now()
         WHERE id = p_oa_lead_id;

        -- Marca interesse e notifica timeline, sem mexer no stage/corretor
        UPDATE public.pipeline_leads
           SET reengajamento_status = 'respondeu_sim', updated_at = now()
         WHERE id = v_existing.id;

        INSERT INTO public.pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, data, status, responsavel_id)
        VALUES (v_existing.id, 'whatsapp',
          '🔥 Interesse confirmado (Oferta Ativa) — template ' || v_tpl,
          'Lead respondeu SIM ao template "' || v_tpl || '" (origem: Oferta Ativa). Já está ATIVO no pipeline — mantido com o corretor atual, sem ir para a Fila do CEO.',
          (now() AT TIME ZONE 'America/Sao_Paulo')::date, 'concluida', v_existing.corretor_id);

        RETURN jsonb_build_object(
          'success', true,
          'pipeline_lead_id', v_existing.id,
          'reused', true,
          'already_active', true,
          'corretor_id', v_existing.corretor_id
        );
      END IF;

      -- Lead existe porém INATIVO (arquivado/descartado): reaproveita via fluxo padrão → Fila do CEO
      UPDATE public.oferta_ativa_leads
         SET status = 'reativado', updated_at = now()
       WHERE id = p_oa_lead_id;
      PERFORM public.reativar_lead_para_fila_ceo(v_existing.id, v_tpl);
      RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true, 'already_active', false);
    END IF;
  END IF;

  -- Não existe no pipeline → cria novo lead diretamente na Fila do CEO
  v_obs := concat(
    '🔄 Lead reengajado pelo template "', v_tpl, '" em ',
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    ' — respondeu SIM (origem: Oferta Ativa / ', COALESCE(v_oa.empreendimento,'lista'), '). Enviado para a Fila do CEO (distribuição manual).',
    CASE WHEN v_foco_label IS NOT NULL THEN ' Interesse atual: ' || v_foco_label || '.' ELSE '' END
  );

  INSERT INTO public.pipeline_leads (
    nome, telefone, email, empreendimento, origem,
    stage_id, stage_changed_at, aceite_status, aceite_expira_em,
    reativado_por_nutricao, reativado_em, reengajamento_status,
    prioridade_lead, arquivado, observacoes
  ) VALUES (
    COALESCE(NULLIF(trim(v_oa.nome),''), 'Lead Oferta Ativa'),
    v_oa.telefone,
    NULLIF(trim(v_oa.email),''),
    v_empreend,
    'Reengajamento',
    v_stage_novo_lead, now(), 'pendente_distribuicao', NULL,
    true, now(), 'respondeu_sim',
    'media', false, v_obs
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (v_new_id, NULL, v_stage_novo_lead, '00000000-0000-0000-0000-000000000000'::uuid,
          'Lead criado a partir da Oferta Ativa (respondeu SIM ao template ' || v_tpl || ') → Fila do CEO');

  UPDATE public.oferta_ativa_leads
     SET status = 'reativado', updated_at = now()
   WHERE id = p_oa_lead_id;

  RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_new_id, 'reused', false, 'already_active', false);
END;
$$;