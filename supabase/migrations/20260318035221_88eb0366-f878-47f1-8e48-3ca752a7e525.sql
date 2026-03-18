
-- ═══════════════════════════════════════════════════════════
-- Fase 3: Matching automático lead ↔ imóvel
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.lead_property_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'novo',
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, property_id)
);

CREATE INDEX idx_lead_property_matches_lead ON public.lead_property_matches(lead_id);
CREATE INDEX idx_lead_property_matches_score ON public.lead_property_matches(score DESC);
CREATE INDEX idx_lead_property_matches_status ON public.lead_property_matches(status);

ALTER TABLE public.lead_property_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage lead property matches"
  ON public.lead_property_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);
