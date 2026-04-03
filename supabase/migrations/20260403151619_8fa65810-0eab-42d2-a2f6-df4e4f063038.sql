
-- Keep first 2 leads for Flávio, unassign the rest
-- Flávio's auth user_id: 8981d8c6-0526-4b43-b84a-ee7fea2a6a2a
DO $$
DECLARE
  v_lead_ids UUID[];
  v_keep_ids UUID[];
  v_redistribute_ids UUID[];
BEGIN
  -- Get all 23 leads distributed to Flávio today
  SELECT ARRAY_AGG(dh.pipeline_lead_id ORDER BY dh.created_at)
  INTO v_lead_ids
  FROM distribuicao_historico dh
  WHERE dh.corretor_id = '8981d8c6-0526-4b43-b84a-ee7fea2a6a2a'
    AND dh.acao = 'distribuido'
    AND dh.created_at::date = '2026-04-03';

  -- Keep first 2 for Flávio
  v_keep_ids := v_lead_ids[1:2];
  v_redistribute_ids := v_lead_ids[3:array_length(v_lead_ids, 1)];

  -- Unassign leads to redistribute
  UPDATE pipeline_leads
  SET corretor_id = NULL,
      aceite_status = 'pendente_distribuicao',
      distribuido_em = NULL,
      aceite_expira_em = NULL,
      updated_at = now()
  WHERE id = ANY(v_redistribute_ids);

  -- Mark old distribution records as 'redistribuido'
  UPDATE distribuicao_historico
  SET acao = 'redistribuido_correcao'
  WHERE pipeline_lead_id = ANY(v_redistribute_ids)
    AND corretor_id = '8981d8c6-0526-4b43-b84a-ee7fea2a6a2a'
    AND acao = 'distribuido'
    AND created_at::date = '2026-04-03';

  -- Clean up roleta_distribuicoes for those leads
  DELETE FROM roleta_distribuicoes
  WHERE lead_id = ANY(v_redistribute_ids)
    AND enviado_em::date = '2026-04-03';

  -- Reset Flávio's roleta_fila counters
  UPDATE roleta_fila
  SET leads_recebidos = 1
  WHERE corretor_id = (SELECT id FROM profiles WHERE user_id = '8981d8c6-0526-4b43-b84a-ee7fea2a6a2a' LIMIT 1)
    AND data = '2026-04-03';

  RAISE NOTICE 'Unassigned % leads for redistribution, kept % for Flávio', 
    array_length(v_redistribute_ids, 1), array_length(v_keep_ids, 1);
END $$;
