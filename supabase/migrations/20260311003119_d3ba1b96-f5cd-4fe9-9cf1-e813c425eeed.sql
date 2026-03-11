
ALTER TABLE public.vitrines 
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'jetimob',
ADD COLUMN IF NOT EXISTS dados_custom jsonb DEFAULT NULL;

COMMENT ON COLUMN public.vitrines.tipo IS 'jetimob or melnick_day';
COMMENT ON COLUMN public.vitrines.dados_custom IS 'Custom offer data for non-Jetimob vitrines (e.g. Melnick Day offers)';
