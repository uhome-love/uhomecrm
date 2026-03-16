
-- AI Calls tracking table for Twilio + ElevenLabs integration
CREATE TABLE public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.pipeline_leads(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  nome_lead TEXT,
  empreendimento TEXT,
  twilio_call_sid TEXT,
  agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  duracao_segundos INTEGER,
  contexto TEXT,
  resultado TEXT,
  resumo_ia TEXT,
  iniciado_por UUID NOT NULL,
  finalizado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_ai_calls_sid ON public.ai_calls(twilio_call_sid);
CREATE INDEX idx_ai_calls_lead ON public.ai_calls(lead_id);
CREATE INDEX idx_ai_calls_created ON public.ai_calls(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can manage ai_calls"
  ON public.ai_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can insert/update (for status callbacks)
CREATE POLICY "Service role full access on ai_calls"
  ON public.ai_calls FOR ALL
  USING (true)
  WITH CHECK (true);
