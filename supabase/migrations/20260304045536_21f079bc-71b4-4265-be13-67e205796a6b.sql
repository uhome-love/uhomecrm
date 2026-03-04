
-- Table to store generated corretor reports
CREATE TABLE public.corretor_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gerente_id UUID NOT NULL,
  corretor_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  corretor_nome TEXT NOT NULL,
  periodo_tipo TEXT NOT NULL DEFAULT 'semanal', -- semanal, mensal, personalizado
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  contexto_gerente TEXT NOT NULL,
  observacoes TEXT,
  dados_metricas JSONB NOT NULL DEFAULT '{}',
  conteudo_relatorio TEXT NOT NULL,
  score_performance INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.corretor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes can view own reports"
  ON public.corretor_reports FOR SELECT
  USING (auth.uid() = gerente_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can insert own reports"
  ON public.corretor_reports FOR INSERT
  WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can delete own reports"
  ON public.corretor_reports FOR DELETE
  USING (auth.uid() = gerente_id);

CREATE INDEX idx_corretor_reports_gerente ON public.corretor_reports(gerente_id);
CREATE INDEX idx_corretor_reports_corretor ON public.corretor_reports(corretor_id);
