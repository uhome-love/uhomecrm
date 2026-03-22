
DELETE FROM notifications WHERE dados::text ILIKE '%a36ef280-aef6-4f3d-9464-2478113e0965%';
DELETE FROM distribuicao_historico WHERE pipeline_lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM ai_calls WHERE lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM campaign_clicks WHERE pipeline_lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM whatsapp_campaign_sends WHERE pipeline_lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM email_campaign_recipients WHERE lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM email_events WHERE lead_id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM pipeline_leads WHERE id = 'a36ef280-aef6-4f3d-9464-2478113e0965';
DELETE FROM leads WHERE id = 'd587142b-bb68-4fa3-a8eb-5b209b9973c2';
