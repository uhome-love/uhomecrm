ALTER TABLE public.pdn_entries ADD COLUMN IF NOT EXISTS construtora text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdn_entries TO authenticated;
GRANT ALL ON public.pdn_entries TO service_role;