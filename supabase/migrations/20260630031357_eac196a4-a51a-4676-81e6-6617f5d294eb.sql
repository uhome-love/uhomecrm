-- Colunas de controle no lead
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS estagnado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estagnado_em timestamptz,
  ADD COLUMN IF NOT EXISTS estagnado_aviso_em timestamptz,
  ADD COLUMN IF NOT EXISTS estagnado_prazo_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_estagnado ON public.pipeline_leads (estagnado) WHERE estagnado = true;

-- Tabela de config por etapa
CREATE TABLE IF NOT EXISTS public.pipeline_estagnacao_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL UNIQUE REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  dias_limite integer NOT NULL DEFAULT 30,
  ativo boolean NOT NULL DEFAULT false,
  limite_backfill_dia integer NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pipeline_estagnacao_config TO authenticated;
GRANT ALL ON public.pipeline_estagnacao_config TO service_role;

ALTER TABLE public.pipeline_estagnacao_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estagnacao_config_select_authenticated"
  ON public.pipeline_estagnacao_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "estagnacao_config_admin_manage"
  ON public.pipeline_estagnacao_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_estagnacao_config_updated_at
  BEFORE UPDATE ON public.pipeline_estagnacao_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: limites por etapa (todas inativas; ativação só na Fase 2 após validação)
INSERT INTO public.pipeline_estagnacao_config (stage_id, dias_limite, ativo, limite_backfill_dia) VALUES
  ('8e2a3285-70f9-438d-be2d-13b0bf4610c4', 7, false, 40),
  ('88be333e-964a-4cfd-8e17-6eb5ea64a286', 15, false, 40),
  ('b0a94ce6-b295-45b8-a023-b23e140d0ba4', 30, false, 40)
ON CONFLICT (stage_id) DO NOTHING;