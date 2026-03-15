
CREATE TABLE public.campaign_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text,
  telefone_normalizado text,
  nome text,
  email text,
  origem text NOT NULL DEFAULT 'SMS_MELNICK_DAY',
  canal text NOT NULL DEFAULT 'brevo',
  campanha text NOT NULL DEFAULT 'MELNICK_DAY_POA_2026',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'click_received',
  pipeline_lead_id uuid REFERENCES public.pipeline_leads(id),
  lead_action text,
  redirected boolean DEFAULT false,
  redirect_url text,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_clicks_telefone ON public.campaign_clicks (telefone_normalizado);
CREATE INDEX idx_campaign_clicks_campanha ON public.campaign_clicks (campanha);
CREATE INDEX idx_campaign_clicks_created ON public.campaign_clicks (created_at DESC);
CREATE INDEX idx_campaign_clicks_status ON public.campaign_clicks (status);

ALTER TABLE public.campaign_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestors can view campaign clicks"
  ON public.campaign_clicks FOR SELECT
  TO authenticated
  USING (public.is_gerente_or_above());
