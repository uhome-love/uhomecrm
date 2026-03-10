
-- Drop FK constraint on lead_id so custom list pipeline_lead IDs can be stored
ALTER TABLE public.oferta_ativa_tentativas DROP CONSTRAINT IF EXISTS oferta_ativa_tentativas_lead_id_fkey;
