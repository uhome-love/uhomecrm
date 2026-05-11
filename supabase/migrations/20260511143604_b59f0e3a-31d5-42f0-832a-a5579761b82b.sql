
CREATE TABLE IF NOT EXISTS public.reengajamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 100,
  lookback_days integer NOT NULL DEFAULT 60,
  evolution_instance text NOT NULL DEFAULT 'uhome-nutricao',
  mensagem_template text NOT NULL DEFAULT 'Olá {nome}! 👋 Aqui é da UHome. Você entrou em contato conosco recentemente sobre imóveis. Ainda está buscando? Temos opções novas que podem combinar com seu perfil. Se quiser que a gente te envie, responde *SIM* aqui mesmo 🏡',
  horario_inicio time NOT NULL DEFAULT '09:00',
  horario_fim time NOT NULL DEFAULT '18:00',
  dias_semana int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reengajamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read reengajamento_config"
  ON public.reengajamento_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage reengajamento_config"
  ON public.reengajamento_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

INSERT INTO public.reengajamento_config (enabled)
  SELECT false WHERE NOT EXISTS (SELECT 1 FROM public.reengajamento_config);

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS reengajamento_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS reengajamento_status text,
  ADD COLUMN IF NOT EXISTS reativado_por_nutricao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reativado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_reativado_nut ON public.pipeline_leads(reativado_por_nutricao) WHERE reativado_por_nutricao = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_reeng_status ON public.pipeline_leads(reengajamento_status) WHERE reengajamento_status IS NOT NULL;
