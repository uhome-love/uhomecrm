ALTER TABLE public.pdn_entries ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.pdn_entries ADD COLUMN IF NOT EXISTS pipeline_lead_id UUID;