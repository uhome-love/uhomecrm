-- Converter FKs bloqueantes (NO ACTION) para SET NULL preservando histórico de marketing
ALTER TABLE public.campaign_clicks DROP CONSTRAINT IF EXISTS campaign_clicks_pipeline_lead_id_fkey;
ALTER TABLE public.campaign_clicks ADD CONSTRAINT campaign_clicks_pipeline_lead_id_fkey
  FOREIGN KEY (pipeline_lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_campaign_sends DROP CONSTRAINT IF EXISTS whatsapp_campaign_sends_pipeline_lead_id_fkey;
ALTER TABLE public.whatsapp_campaign_sends ADD CONSTRAINT whatsapp_campaign_sends_pipeline_lead_id_fkey
  FOREIGN KEY (pipeline_lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

ALTER TABLE public.email_campaign_recipients DROP CONSTRAINT IF EXISTS email_campaign_recipients_lead_id_fkey;
ALTER TABLE public.email_campaign_recipients ADD CONSTRAINT email_campaign_recipients_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS email_events_lead_id_fkey;
ALTER TABLE public.email_events ADD CONSTRAINT email_events_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

ALTER TABLE public.site_events DROP CONSTRAINT IF EXISTS site_events_pipeline_lead_id_fkey;
ALTER TABLE public.site_events ADD CONSTRAINT site_events_pipeline_lead_id_fkey
  FOREIGN KEY (pipeline_lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_ai_log DROP CONSTRAINT IF EXISTS whatsapp_ai_log_lead_id_fkey;
ALTER TABLE public.whatsapp_ai_log ADD CONSTRAINT whatsapp_ai_log_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;