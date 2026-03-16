
-- =============================================
-- EMAIL MODULE - Complete Schema
-- =============================================

-- 1. Email Settings (Mailgun configuration)
CREATE TABLE public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only email_settings" ON public.email_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default Mailgun settings
INSERT INTO public.email_settings (key, value) VALUES
  ('mailgun_domain', 'sandbox08945e71a1d44fb9b0e5ae9cd049c4fc.mailgun.org'),
  ('mailgun_base_url', 'https://api.mailgun.net'),
  ('mailgun_from', 'UhomeSales <noreply@sandbox08945e71a1d44fb9b0e5ae9cd049c4fc.mailgun.org>'),
  ('mailgun_reply_to', ''),
  ('tracking_opens', 'true'),
  ('tracking_clicks', 'true'),
  ('tracking_unsubscribe', 'true'),
  ('webhook_signing_key', '');

-- 2. Email Templates
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  assunto text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  text_content text,
  categoria text DEFAULT 'geral',
  placeholders text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  criado_por text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor+ can manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 3. Email Campaigns
CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  assunto text NOT NULL,
  remetente text,
  preview_text text,
  template_id uuid REFERENCES public.email_templates(id),
  html_content text,
  text_content text,
  filtros jsonb DEFAULT '{}',
  status text DEFAULT 'rascunho',
  agendado_para timestamptz,
  criado_por text NOT NULL,
  total_destinatarios int DEFAULT 0,
  total_enviados int DEFAULT 0,
  total_entregues int DEFAULT 0,
  total_aberturas int DEFAULT 0,
  total_cliques int DEFAULT 0,
  total_bounces int DEFAULT 0,
  total_unsubscribes int DEFAULT 0,
  total_erros int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor+ can manage email_campaigns" ON public.email_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 4. Email Campaign Recipients
CREATE TABLE public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.pipeline_leads(id),
  email text NOT NULL,
  nome text,
  variaveis jsonb DEFAULT '{}',
  status text DEFAULT 'pendente',
  mailgun_message_id text,
  enviado_at timestamptz,
  entregue_at timestamptz,
  aberto_at timestamptz,
  clicado_at timestamptz,
  aberturas int DEFAULT 0,
  cliques int DEFAULT 0,
  erro text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor+ can manage email_campaign_recipients" ON public.email_campaign_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 5. Email Events (webhook tracking)
CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id),
  recipient_id uuid REFERENCES public.email_campaign_recipients(id),
  lead_id uuid REFERENCES public.pipeline_leads(id),
  mailgun_message_id text,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  url text,
  ip text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor+ can read email_events" ON public.email_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Service can insert email_events" ON public.email_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6. Suppression List (bounces, complaints, unsubscribes)
CREATE TABLE public.email_suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  motivo text NOT NULL,
  origem text,
  campaign_id uuid REFERENCES public.email_campaigns(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor+ can manage email_suppression_list" ON public.email_suppression_list
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Indexes for performance
CREATE INDEX idx_email_events_campaign ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_lead ON public.email_events(lead_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);
CREATE INDEX idx_email_events_message ON public.email_events(mailgun_message_id);
CREATE INDEX idx_email_recipients_campaign ON public.email_campaign_recipients(campaign_id);
CREATE INDEX idx_email_recipients_lead ON public.email_campaign_recipients(lead_id);
CREATE INDEX idx_email_recipients_status ON public.email_campaign_recipients(status);
CREATE INDEX idx_email_suppression_email ON public.email_suppression_list(email);
