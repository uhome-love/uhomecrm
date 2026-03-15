
-- =====================================================
-- Campaign Activation Analytics Table
-- =====================================================
CREATE TABLE public.melnick_campaign_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign TEXT NOT NULL DEFAULT 'MELNICK_DAY_2026',
  tipo TEXT NOT NULL, -- 'reactivated', 'new_lead', 'sent_to_roleta', 'visit_scheduled', 'proposal', 'sale'
  lead_id UUID,
  pipeline_lead_id UUID,
  telefone TEXT,
  origem_canal TEXT, -- 'sms', 'whatsapp', 'ai_call', 'email'
  rule_applied TEXT, -- 'rule_1', 'rule_2', 'rule_3'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_melnick_analytics_campaign ON public.melnick_campaign_analytics(campaign);
CREATE INDEX idx_melnick_analytics_tipo ON public.melnick_campaign_analytics(tipo);

-- RLS
ALTER TABLE public.melnick_campaign_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read analytics"
ON public.melnick_campaign_analytics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert analytics"
ON public.melnick_campaign_analytics FOR INSERT TO authenticated WITH CHECK (true);
