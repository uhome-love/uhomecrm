
-- Add recovery status and situation type to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS status_recuperacao text DEFAULT 'pendente';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_situacao text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS corretor_responsavel text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS observacoes text;

-- Add index for recovery status filtering
CREATE INDEX IF NOT EXISTS idx_leads_status_recuperacao ON public.leads(status_recuperacao);
