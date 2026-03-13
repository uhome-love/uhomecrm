CREATE TABLE public.vitrine_interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vitrine_id UUID NOT NULL,
  imovel_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  lead_nome TEXT,
  lead_telefone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vitrine_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert vitrine interactions"
  ON public.vitrine_interacoes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read vitrine interactions"
  ON public.vitrine_interacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_vitrine_interacoes_vitrine ON public.vitrine_interacoes(vitrine_id);
CREATE INDEX idx_vitrine_interacoes_tipo ON public.vitrine_interacoes(tipo);
