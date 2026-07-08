ALTER TABLE public.pdn_entries ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pdn_entries_negocio_id ON public.pdn_entries(negocio_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdn_entries_gerente_negocio ON public.pdn_entries(gerente_id, negocio_id) WHERE negocio_id IS NOT NULL;