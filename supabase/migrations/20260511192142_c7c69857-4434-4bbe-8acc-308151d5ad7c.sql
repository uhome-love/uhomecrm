CREATE OR REPLACE FUNCTION public.reativar_lead_nutricao_manual(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_dist jsonb;
BEGIN
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
         updated_at = now()
   WHERE id = p_lead_id;

  INSERT INTO pipeline_historico (pipeline_lead_id, observacao)
  VALUES (p_lead_id, '🔄 REATIVADO POR NUTRIÇÃO (manual) — voltando para a roleta');

  BEGIN
    SELECT distribuir_lead_atomico(p_lead_id, NULL, NULL, false) INTO v_dist;
  EXCEPTION WHEN OTHERS THEN
    v_dist := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object('success', true, 'distribuicao', v_dist);
END;
$function$;