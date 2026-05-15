ALTER TABLE public.visita_amanha_config ADD COLUMN IF NOT EXISTS running_until timestamptz;
UPDATE public.visita_amanha_config SET running_until = NULL;