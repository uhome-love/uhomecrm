DROP TRIGGER IF EXISTS trg_pdn_mirror_pipeline_lead ON public.pipeline_leads;
DROP TRIGGER IF EXISTS trg_pdn_mirror_negocio ON public.negocios;
DROP FUNCTION IF EXISTS public.trg_pdn_mirror_pipeline_lead();
DROP FUNCTION IF EXISTS public.trg_pdn_mirror_negocio();

ALTER TABLE public.pdn_entries ALTER COLUMN nome DROP NOT NULL;