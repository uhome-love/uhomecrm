CREATE OR REPLACE FUNCTION public.reativar_lead_nutricao_manual(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_stage_anterior uuid;
  v_movido_por uuid;
  v_dist jsonb;
  v_origem_atual text;
  v_obs_atual text;
  v_nova_obs text;
BEGIN
  SELECT stage_id, origem, COALESCE(observacoes,'')
    INTO v_stage_anterior, v_origem_atual, v_obs_atual
  FROM pipeline_leads WHERE id = p_lead_id;

  v_movido_por := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- Preserva origem original na observação se ainda não foi marcado
  IF v_obs_atual NOT ILIKE '%Reativado por Nutrição%' THEN
    v_nova_obs := '🔄 Reativado por Nutrição em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
                  || ' (origem original: ' || COALESCE(v_origem_atual,'não informada') || ')'
                  || E'\n---\n' || v_obs_atual;
  ELSE
    v_nova_obs := v_obs_atual;
  END IF;

  UPDATE pipeline_leads
     SET reengajamento_status = 'respondeu_sim',
         reativado_por_nutricao = true,
         reativado_em = now(),
         stage_id = v_stage_sem_contato,
         stage_changed_at = now(),
         corretor_id = NULL,
         aceite_status = 'pendente',
         aceite_expira_em = NULL,
         aceito_em = NULL,
         tipo_descarte = NULL,
         motivo_descarte = NULL,
         origem = 'Nutrição',
         observacoes = v_nova_obs,
         updated_at = now()
   WHERE id = p_lead_id;

  INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (p_lead_id, v_stage_anterior, v_stage_sem_contato, v_movido_por,
          '🔄 REATIVADO POR NUTRIÇÃO (manual) — origem original: ' || COALESCE(v_origem_atual,'não informada') || ' — voltando para a roleta');

  BEGIN
    SELECT distribuir_lead_atomico(p_lead_id, NULL, NULL, false) INTO v_dist;
  EXCEPTION WHEN OTHERS THEN
    v_dist := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object('success', true, 'distribuicao', v_dist);
END;
$function$;