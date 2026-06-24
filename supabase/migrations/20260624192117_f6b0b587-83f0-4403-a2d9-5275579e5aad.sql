CREATE OR REPLACE FUNCTION public.reativar_oferta_ativa_para_fila_ceo(p_oa_lead_id uuid, p_template_name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
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

  -- Se já existe lead no pipeline com o mesmo telefone, reaproveita-o via fluxo padrão
  IF v_phone8 IS NOT NULL AND length(v_phone8) = 8 THEN
    SELECT id INTO v_existing
    FROM public.pipeline_leads
    WHERE right(regexp_replace(COALESCE(telefone,''), '[^0-9]', '', 'g'), 8) = v_phone8
    ORDER BY (NOT arquivado) DESC, updated_at DESC
    LIMIT 1;

    IF FOUND THEN
      -- Marca o lead de oferta ativa como reaproveitado
      UPDATE public.oferta_ativa_leads
         SET status = 'reativado', updated_at = now()
       WHERE id = p_oa_lead_id;
      PERFORM public.reativar_lead_para_fila_ceo(v_existing.id, v_tpl);
      RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_existing.id, 'reused', true);
    END IF;
  END IF;

  -- Cria novo lead no pipeline diretamente na Fila do CEO
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

  -- Histórico
  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (v_new_id, NULL, v_stage_novo_lead, '00000000-0000-0000-0000-000000000000'::uuid,
          'Lead criado a partir da Oferta Ativa (respondeu SIM ao template ' || v_tpl || ') → Fila do CEO');

  -- Marca o lead de oferta ativa como reaproveitado
  UPDATE public.oferta_ativa_leads
     SET status = 'reativado', updated_at = now()
   WHERE id = p_oa_lead_id;

  RETURN jsonb_build_object('success', true, 'pipeline_lead_id', v_new_id, 'reused', false);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reativar_oferta_ativa_para_fila_ceo(uuid, text) TO service_role;