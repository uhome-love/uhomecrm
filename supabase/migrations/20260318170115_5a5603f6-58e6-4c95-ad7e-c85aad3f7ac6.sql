
-- Note: lista already created in previous failed migration attempts, check first
-- Clean up orphaned lista entries from failed attempts
DELETE FROM oferta_ativa_listas WHERE nome = 'Leads Descartados - Março 2026' AND total_leads = 0;

DO $$
DECLARE
  v_lista_id uuid := gen_random_uuid();
  v_stage_id uuid := '1dd66c25-3848-4053-9f66-82e902989b4d';
BEGIN
  -- 1. Create new OA lista
  INSERT INTO oferta_ativa_listas (id, nome, empreendimento, campanha, origem, status, max_tentativas, cooldown_dias, total_leads, criado_por)
  VALUES (v_lista_id, 'Leads Descartados - Março 2026', 'Diversos', NULL, 'pipeline_descarte', 'ativa', 5, 3, 0, '00000000-0000-0000-0000-000000000000');

  -- 2. Insert into OA (skip duplicates)
  INSERT INTO oferta_ativa_leads (lista_id, nome, telefone, telefone2, email, telefone_normalizado, empreendimento, campanha, origem, data_lead, observacoes, status, motivo_descarte)
  SELECT v_lista_id, pl.nome, pl.telefone, pl.telefone2, pl.email,
    CASE WHEN pl.telefone IS NOT NULL AND length(regexp_replace(pl.telefone, '\D', '', 'g')) BETWEEN 10 AND 11
      THEN regexp_replace(pl.telefone, '\D', '', 'g') ELSE NULL END,
    COALESCE(pl.empreendimento, 'Sem empreendimento'), pl.campanha, pl.origem, pl.created_at::date,
    CONCAT_WS(E'\n',
      CASE WHEN pl.observacoes IS NOT NULL AND pl.observacoes != '' THEN pl.observacoes END,
      CASE WHEN pl.motivo_descarte IS NOT NULL THEN 'Motivo descarte: ' || pl.motivo_descarte END,
      'Corretor anterior: ' || COALESCE((SELECT p.nome FROM profiles p WHERE p.id = pl.corretor_id), 'N/A'),
      'Origem pipeline: ' || COALESCE(pl.origem, 'N/A')
    ),
    CASE WHEN pl.telefone IS NOT NULL AND length(regexp_replace(pl.telefone, '\D', '', 'g')) BETWEEN 10 AND 11 THEN 'na_fila' ELSE 'descartado' END,
    CASE WHEN pl.telefone IS NULL OR length(regexp_replace(pl.telefone, '\D', '', 'g')) NOT BETWEEN 10 AND 11 THEN 'telefone_invalido' ELSE NULL END
  FROM pipeline_leads pl WHERE pl.stage_id = v_stage_id
  ON CONFLICT DO NOTHING;

  -- 3. Update total
  UPDATE oferta_ativa_listas SET total_leads = (SELECT count(*) FROM oferta_ativa_leads WHERE lista_id = v_lista_id) WHERE id = v_lista_id;

  -- 4. Log activity
  INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, created_by)
  SELECT pl.id, 'sistema', '📦 Movido para Oferta Ativa',
    'Lead descartado movido para lista "Leads Descartados - Março 2026" na Oferta Ativa.',
    COALESCE(pl.corretor_id, pl.created_by, '00000000-0000-0000-0000-000000000000')
  FROM pipeline_leads pl WHERE pl.stage_id = v_stage_id;

  -- 5. Clean all FK references before deleting leads
  DELETE FROM distribuicao_historico WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_historico WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_atividades WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_anotacoes WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_tarefas WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_parcerias WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_lead_sequencias WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM pipeline_comissoes WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM visitas WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM lead_imovel_events WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM ia_call_results WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM campaign_clicks WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM whatsapp_campaign_sends WHERE pipeline_lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM email_campaign_recipients WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM email_events WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM ai_calls WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM lead_property_profiles WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM lead_property_searches WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM lead_property_interactions WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);
  DELETE FROM lead_property_matches WHERE lead_id IN (SELECT id FROM pipeline_leads WHERE stage_id = v_stage_id);

  -- 6. Delete from pipeline
  DELETE FROM pipeline_leads WHERE stage_id = v_stage_id;
END $$;
