
-- Table for auto-generated weekly 1:1 reports
CREATE TABLE public.one_on_one_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  corretor_id UUID NOT NULL,
  gerente_id UUID NOT NULL,
  corretor_nome TEXT NOT NULL DEFAULT '',
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  dados_semana JSONB NOT NULL DEFAULT '{}'::jsonb,
  contexto_auto TEXT,
  conteudo_relatorio TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  aprovado_em TIMESTAMPTZ,
  aprovado_por UUID,
  score_performance INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.one_on_one_reports ENABLE ROW LEVEL SECURITY;

-- Gestors can see their own reports
CREATE POLICY "Gestors can manage own reports"
ON public.one_on_one_reports
FOR ALL
TO authenticated
USING (gerente_id = auth.uid())
WITH CHECK (gerente_id = auth.uid());

-- Admins can see all
CREATE POLICY "Admins can view all reports"
ON public.one_on_one_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast queries
CREATE INDEX idx_one_on_one_reports_gerente ON public.one_on_one_reports(gerente_id, status);
CREATE INDEX idx_one_on_one_reports_corretor ON public.one_on_one_reports(corretor_id, periodo_inicio);
