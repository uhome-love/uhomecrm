
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS toque_marcacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS toque_d1_at timestamptz,
  ADD COLUMN IF NOT EXISTS toque_d0_at timestamptz,
  ADD COLUMN IF NOT EXISTS resposta_at timestamptz,
  ADD COLUMN IF NOT EXISTS resposta_texto text,
  ADD COLUMN IF NOT EXISTS risco_alertado_at timestamptz;

ALTER TABLE public.visitas
  DROP CONSTRAINT IF EXISTS visitas_confirmacao_status_check;

ALTER TABLE public.visitas
  ADD CONSTRAINT visitas_confirmacao_status_check
  CHECK (confirmacao_status IN (
    'pendente','enviado_marcacao','enviado_d1','enviado_d0',
    'confirmado','pediu_remarcar','risco_no_show'
  )) NOT VALID;

ALTER TABLE public.visitas VALIDATE CONSTRAINT visitas_confirmacao_status_check;

CREATE INDEX IF NOT EXISTS idx_visitas_confirmacao_pendente
  ON public.visitas (data_visita, confirmacao_status)
  WHERE confirmacao_status <> 'confirmado';
