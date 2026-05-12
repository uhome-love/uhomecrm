CREATE OR REPLACE FUNCTION public.reativar_lead_nutricao_manual(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_novo_lead uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
  v_stage_anterior uuid;
  v_movido_por uuid;
  v_dist jsonb;
  v_origem_atual text;
  v_obs_atual text;
  v_nova_obs text;
  v_lead record;
  v_parcerias_canceladas int := 0;
  v_exclude_auth uuid;
BEGIN
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  END IF;

  v_stage_anterior := v_lead.stage_id;
  v_origem_atual := COALESCE(v_lead.origem, 'não informada');
  v_obs_atual := COALESCE(v_lead.observacoes, '');
  v_movido_por := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_exclude_auth := v_lead.corretor_id;

  UPDATE public.pipeline_parcerias
     SET status = 'cancelada',
         motivo = concat_ws(' | ', nullif(motivo, ''), 'Cancelada: lead reativado pela Nutrição'),
         updated_at = now()
   WHERE pipeline_lead_id = p_lead_id AND status = 'ativa';
  GET DIAGNOSTICS v_parcerias_canceladas = ROW_COUNT;

  IF v_obs_atual ILIKE '%Reativado por Nutrição%' THEN
    v_nova_obs := v_obs_atual;
  ELSE
    v_nova_obs := concat(
      '🔄 Reativado por Nutrição em ',
      to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      ' (origem original: ', v_origem_atual, ')',
      CASE WHEN v_obs_atual <> '' THEN E'\n---\n' || v_obs_atual ELSE '' END
    );
  END IF;

  UPDATE public.pipeline_leads
     SET reengajamento_status = 'respondeu_sim',
         reativado_por_nutricao = true,
         reativado_em = now(),
         origem = 'Nutrição',
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
    '🔄 REATIVADO POR NUTRIÇÃO — resposta positiva. Origem original: ' || v_origem_atual ||
    '. Retornado para a roleta como Novo Lead (corretor anterior excluído).');

  BEGIN
    SELECT public.distribuir_lead_atomico(p_lead_id, NULL, v_exclude_auth, false) INTO v_dist;
  EXCEPTION WHEN OTHERS THEN
    v_dist := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true, 'lead_id', p_lead_id, 'origem_anterior', v_origem_atual,
    'parcerias_canceladas', v_parcerias_canceladas,
    'corretor_anterior_excluido', v_exclude_auth, 'distribuicao', v_dist
  );
END;
$function$;

-- Corrige Thiago Araújo
DO $$
DECLARE
  v_lead_id uuid := 'a8d48e4d-0921-4ff1-b74d-6cb74caa55e4';
  v_taynah_auth uuid := 'b473388d-a660-487c-999c-16dee0f19f80';
  v_taynah_profile uuid := 'c4fc833f-9e6f-447b-9686-241870b4a64e';
  v_dist jsonb;
BEGIN
  UPDATE public.roleta_distribuicoes
     SET status = 'repassado'
   WHERE lead_id = v_lead_id AND corretor_id = v_taynah_profile
     AND status = 'aceito' AND enviado_em > now() - interval '1 hour';

  UPDATE public.pipeline_leads
     SET corretor_id = NULL, corretor_anterior_id = v_taynah_auth,
         aceite_status = 'pendente_distribuicao',
         aceite_expira_em = NULL, aceito_em = NULL, distribuido_em = NULL,
         arquivado = false, stage_changed_at = now(), updated_at = now()
   WHERE id = v_lead_id;

  SELECT public.distribuir_lead_atomico(v_lead_id, NULL, v_taynah_auth, false) INTO v_dist;
  RAISE NOTICE 'Redistribuição Thiago: %', v_dist;
END $$;