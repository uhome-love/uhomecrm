
-- ============ 1. Coluna + índice ============
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS primeiro_contato_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_primeiro_contato_null
  ON public.pipeline_leads (created_at)
  WHERE primeiro_contato_em IS NULL;

-- ============ 2. Classificação humano (lista de exclusão) ============
-- Fonte única da verdade — usada pelo trigger E pelo script de backfill.
CREATE OR REPLACE FUNCTION public.perf_atividade_humana(p_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- aproveitado_oa NUNCA é excluído (ponte da Fase 1A conta como humano).
  SELECT COALESCE(p_tipo, '') NOT IN (
    'nurturing_sequencia',
    'sistema',
    'entrada',
    'mudanca_etapa',
    'campanha_atrio',
    'pdn_risco',
    'match'
  );
$$;

-- ============ 3. Trigger de primeiro contato ============
CREATE OR REPLACE FUNCTION public.perf_set_primeiro_contato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- guard: só age em inserts recentes (evita replays antigos)
  IF NEW.created_at IS NULL OR NEW.created_at < now() - interval '1 day' THEN
    RETURN NEW;
  END IF;

  IF NOT public.perf_atividade_humana(NEW.tipo) THEN
    RETURN NEW;
  END IF;

  UPDATE public.pipeline_leads
     SET primeiro_contato_em = NEW.created_at
   WHERE id = NEW.pipeline_lead_id
     AND primeiro_contato_em IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perf_primeiro_contato ON public.pipeline_atividades;
CREATE TRIGGER trg_perf_primeiro_contato
AFTER INSERT ON public.pipeline_atividades
FOR EACH ROW
EXECUTE FUNCTION public.perf_set_primeiro_contato();

-- ============ 4. Tabela perf_thresholds ============
CREATE TABLE IF NOT EXISTS public.perf_thresholds (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.perf_thresholds TO authenticated;
GRANT ALL ON public.perf_thresholds TO service_role;

ALTER TABLE public.perf_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perf_thresholds_read ON public.perf_thresholds;
CREATE POLICY perf_thresholds_read ON public.perf_thresholds
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS perf_thresholds_admin_write ON public.perf_thresholds;
CREATE POLICY perf_thresholds_admin_write ON public.perf_thresholds
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seeds
INSERT INTO public.perf_thresholds (chave, valor) VALUES
  ('sla_horas',          '{"verde": 2, "amarelo": 8, "vermelho": 24}'),
  ('presenca_min',       '{"amarelo": 0.60, "vermelho": 0.40}'),
  ('no_show_max',        '{"amarelo": 0.20, "vermelho": 0.35}'),
  ('conv_visita_min',    '{"amarelo": 0.15, "vermelho": 0.08}'),
  ('wip_negociacao_max', '{"amarelo": 8, "vermelho": 15}'),
  ('oa_min_tentativas',  '{"amarelo": 20, "vermelho": 5}'),
  ('leads_min_periodo',  '{"amarelo": 10, "vermelho": 3}'),
  ('coorte_dias',        '30'::jsonb),
  ('vgv_zero_dias',      '30'::jsonb)
ON CONFLICT (chave) DO NOTHING;
