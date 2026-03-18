-- Fix Merjully: 31983438810383438810 → 31983438810
UPDATE pipeline_leads SET telefone = '31983438810' WHERE id = 'd090494e-9866-4dca-85a6-8da11334dc84';

-- Fix Sergio: 51998761235551993714796 → 51998761235
UPDATE pipeline_leads SET telefone = '51998761235' WHERE id = '44ff1b60-89dc-40a6-9d18-276a5459edbd';

-- Also update observacoes to include second phone where applicable
UPDATE pipeline_leads SET observacoes = observacoes || E'\nTelefone 2: 51993714796' WHERE id = '44ff1b60-89dc-40a6-9d18-276a5459edbd';