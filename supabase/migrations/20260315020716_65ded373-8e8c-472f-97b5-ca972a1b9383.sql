
-- Activity log for AI phone call results
CREATE TABLE public.ia_call_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  resumo TEXT NOT NULL,
  finalidade TEXT,
  regiao_interesse TEXT,
  faixa_investimento TEXT,
  prazo_compra TEXT,
  proxima_acao TEXT NOT NULL,
  prioridade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookups by lead
CREATE INDEX idx_ia_call_results_lead_id ON public.ia_call_results(lead_id);

-- RLS: only service_role (edge functions) can write; authenticated can read
ALTER TABLE public.ia_call_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ia_call_results"
  ON public.ia_call_results FOR SELECT TO authenticated
  USING (true);
