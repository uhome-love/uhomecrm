
CREATE TABLE IF NOT EXISTS public.homi_briefing_diario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id UUID NOT NULL,
  status_geral TEXT,
  frase_do_dia TEXT,
  destaques JSONB,
  alertas JSONB,
  acao_prioritaria TEXT,
  previsao TEXT,
  dados_contexto JSONB,
  gerado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(data, user_id)
);

ALTER TABLE public.homi_briefing_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own briefings"
  ON public.homi_briefing_diario
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own briefings"
  ON public.homi_briefing_diario
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own briefings"
  ON public.homi_briefing_diario
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to briefings"
  ON public.homi_briefing_diario
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
