-- Fix jetimob_campaign_map: Melnick Day Alto Padrão → Altíssimo Padrão
UPDATE jetimob_campaign_map SET segmento = 'Altíssimo Padrão', updated_at = now() WHERE id = 'fd7cf0e9-734f-4b30-9b0f-7113cef39592';

-- Fix jetimob_campaign_map: Me Day Médio Padrão → Médio-Alto Padrão  
UPDATE jetimob_campaign_map SET segmento = 'Médio-Alto Padrão', updated_at = now() WHERE id = 'eae82e71-8e55-4c90-b626-5c6c032d7815';