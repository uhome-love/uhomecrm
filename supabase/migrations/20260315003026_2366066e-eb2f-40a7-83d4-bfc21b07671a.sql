
-- Lead-imóvel events table for tracking broker actions linked to leads
CREATE TABLE public.lead_imovel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  imovel_codigo TEXT,
  vitrine_id UUID,
  search_query TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lead timeline queries
CREATE INDEX idx_lead_imovel_events_lead_id ON public.lead_imovel_events(lead_id, created_at DESC);
CREATE INDEX idx_lead_imovel_events_corretor ON public.lead_imovel_events(corretor_id, created_at DESC);

-- RLS
ALTER TABLE public.lead_imovel_events ENABLE ROW LEVEL SECURITY;

-- Corretors can insert their own events
CREATE POLICY "Users can insert own events"
  ON public.lead_imovel_events FOR INSERT
  TO authenticated
  WITH CHECK (corretor_id = auth.uid());

-- Corretors can view their own events
CREATE POLICY "Users can view own events"
  ON public.lead_imovel_events FOR SELECT
  TO authenticated
  USING (corretor_id = auth.uid());

-- Gestors can view events from their team
CREATE POLICY "Gestors can view team events"
  ON public.lead_imovel_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gestor')
  );
