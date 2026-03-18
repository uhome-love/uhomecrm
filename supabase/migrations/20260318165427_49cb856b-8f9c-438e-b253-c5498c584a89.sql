-- Fix existing Melnick Day landing page leads: remove "Avulso" from empreendimento
UPDATE pipeline_leads 
SET empreendimento = 'Melnick Day 2026' 
WHERE empreendimento = 'Avulso - Landing Page' 
AND (campanha ILIKE '%Melnick%' OR plataforma ILIKE '%Melnick%');

-- Also update the reactivation observacoes that reference "Avulso - Landing Page"
UPDATE pipeline_leads 
SET observacoes = REPLACE(observacoes, 'Avulso - Landing Page', 'Melnick Day 2026')
WHERE observacoes ILIKE '%Avulso - Landing Page%' 
AND (campanha ILIKE '%Melnick%' OR plataforma ILIKE '%Melnick%');