-- Add entry activities for Melnick Day landing page leads that don't have one
INSERT INTO pipeline_atividades (pipeline_lead_id, tipo, titulo, descricao, status, created_by, created_at)
SELECT 
  pl.id,
  'entrada',
  '🏠 Lead gerado Landing Page Melnick Day',
  'Lead recebido via Landing Page Melnick Day' || E'\n' || 'Empreendimento: ' || COALESCE(pl.empreendimento, 'Melnick Day 2026'),
  'concluida',
  '00000000-0000-0000-0000-000000000000',
  pl.created_at
FROM pipeline_leads pl
WHERE pl.campanha ILIKE '%Melnick%Landing%'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_atividades pa 
  WHERE pa.pipeline_lead_id = pl.id AND pa.tipo = 'entrada'
);