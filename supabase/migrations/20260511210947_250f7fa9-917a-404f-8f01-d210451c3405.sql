CREATE OR REPLACE FUNCTION public.reativar_lead_nutricao_manual(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_origem_original text;
  v_parcerias_canceladas int := 0;
BEGIN
  SELECT * INTO v_lead FROM pipeline_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  END IF;

  v_origem_original := COALESCE(v_lead.origem, 'desconhecida');

  -- Cancelar quaisquer parcerias ativas existentes
  UPDATE pipeline_parcerias
     SET status = 'cancelada',
         motivo = COALESCE(motivo,'') || ' | Cancelada: lead reativado via Nutrição',
         updated_at = now()
   WHERE pipeline_lead_id = p_lead_id
     AND status = 'ativa';
  GET DIAGNOSTICS v_parcerias_canceladas = ROW_COUNT;

  UPDATE pipeline_leads
     SET origem = 'Nutrição',
         observacoes = COALESCE(observacoes,'') ||
           E'\n🔄 Reativado por Nutrição em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
           ' (origem original: ' || v_origem_original || ')',
         reativado_por_nutricao = true,
         corretor_id = NULL,
         corretor_anterior_id = v_lead.corretor_id,
         aceite_status = 'pendente_distribuicao',
         distribuido_em = NULL,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'origem_anterior', v_origem_original,
    'parcerias_canceladas', v_parcerias_canceladas
  );
END;
$$;