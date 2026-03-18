
-- Add Seen Três Figueiras to Altíssimo Padrão segment
UPDATE pipeline_segmentos 
SET empreendimentos = array_append(empreendimentos, 'Seen Três Figueiras'),
    updated_at = now()
WHERE id = '5e930c09-634d-40e1-9ccc-981b0a4eae74';

-- Fix existing leads: normalize name and set segmento
UPDATE pipeline_leads 
SET segmento_id = '5e930c09-634d-40e1-9ccc-981b0a4eae74',
    empreendimento = 'Seen Três Figueiras',
    updated_at = now()
WHERE empreendimento ILIKE '%seen%figueiras%' 
  AND segmento_id IS NULL;
