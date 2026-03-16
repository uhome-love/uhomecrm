
-- Prevent duplicate active leads by email
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_leads_unique_email_active 
ON pipeline_leads (LOWER(email)) 
WHERE email IS NOT NULL AND aceite_status != 'descartado';

-- Prevent duplicate active leads by phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_leads_unique_phone_active 
ON pipeline_leads (telefone_normalizado) 
WHERE telefone_normalizado IS NOT NULL AND aceite_status != 'descartado';
