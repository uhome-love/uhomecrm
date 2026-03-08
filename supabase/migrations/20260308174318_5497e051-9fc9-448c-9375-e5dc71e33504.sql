
CREATE TABLE empreendimento_fichas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empreendimento TEXT NOT NULL UNIQUE,
  entrada TEXT,
  metragens TEXT,
  entrega TEXT,
  desconto TEXT,
  localizacao TEXT,
  notas TEXT,
  atualizado_por UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE empreendimento_fichas ENABLE ROW LEVEL SECURITY;

CREATE POLICY empreendimento_fichas_select ON empreendimento_fichas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY empreendimento_fichas_insert ON empreendimento_fichas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY empreendimento_fichas_update ON empreendimento_fichas
  FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_empreendimento_fichas_nome ON empreendimento_fichas(empreendimento);
