
-- Table to store generated executive monthly reports
CREATE TABLE public.executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes text NOT NULL,
  titulo text NOT NULL,
  sumario_executivo text,
  metricas jsonb DEFAULT '{}'::jsonb,
  comparativo jsonb DEFAULT '{}'::jsonb,
  ranking_equipes jsonb DEFAULT '[]'::jsonb,
  ranking_corretores jsonb DEFAULT '[]'::jsonb,
  funil jsonb DEFAULT '{}'::jsonb,
  campanhas jsonb DEFAULT '[]'::jsonb,
  diagnostico_ia text,
  conteudo_completo text,
  status text NOT NULL DEFAULT 'gerando',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on month
ALTER TABLE public.executive_reports ADD CONSTRAINT executive_reports_mes_unique UNIQUE (mes);

-- Enable RLS
ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can manage executive reports"
  ON public.executive_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
