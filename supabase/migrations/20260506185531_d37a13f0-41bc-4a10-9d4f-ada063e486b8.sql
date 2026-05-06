
-- Tabela de integrações de calendário por corretor
CREATE TABLE public.corretor_calendar_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active',
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT corretor_calendar_unique UNIQUE (corretor_id, provider),
  CONSTRAINT corretor_calendar_provider_check CHECK (provider IN ('google','outlook')),
  CONSTRAINT corretor_calendar_status_check CHECK (status IN ('active','revoked','error'))
);

CREATE INDEX idx_corretor_calendar_corretor ON public.corretor_calendar_integrations(corretor_id);
CREATE INDEX idx_corretor_calendar_status ON public.corretor_calendar_integrations(status);

ALTER TABLE public.corretor_calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor vê própria integração"
  ON public.corretor_calendar_integrations FOR SELECT
  USING (auth.uid() = corretor_id);

CREATE POLICY "Corretor cria própria integração"
  ON public.corretor_calendar_integrations FOR INSERT
  WITH CHECK (auth.uid() = corretor_id);

CREATE POLICY "Corretor atualiza própria integração"
  ON public.corretor_calendar_integrations FOR UPDATE
  USING (auth.uid() = corretor_id);

CREATE POLICY "Corretor remove própria integração"
  ON public.corretor_calendar_integrations FOR DELETE
  USING (auth.uid() = corretor_id);

CREATE TRIGGER trg_corretor_calendar_updated
  BEFORE UPDATE ON public.corretor_calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas novas em visitas
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_link text,
  ADD COLUMN IF NOT EXISTS confirmacao_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmacao_status text DEFAULT 'pendente';

CREATE INDEX IF NOT EXISTS idx_visitas_confirmacao_status ON public.visitas(confirmacao_status);
