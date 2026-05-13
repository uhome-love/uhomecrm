
-- 1. Trigger defensiva: se um insert em pipeline_leads vier sem stage_id, atribui o "Novo Lead" do pipeline padrão
CREATE OR REPLACE FUNCTION public.ensure_pipeline_lead_default_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_stage uuid;
BEGIN
  IF NEW.stage_id IS NULL THEN
    SELECT id INTO v_default_stage
    FROM public.pipeline_stages
    WHERE pipeline_tipo = COALESCE(
        (SELECT pipeline_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id LIMIT 1),
        'leads'
      )
      AND ativo = true
    ORDER BY ordem ASC
    LIMIT 1;

    IF v_default_stage IS NULL THEN
      SELECT id INTO v_default_stage
      FROM public.pipeline_stages
      WHERE ativo = true
      ORDER BY ordem ASC
      LIMIT 1;
    END IF;

    NEW.stage_id := v_default_stage;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_leads_default_stage ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_leads_default_stage
BEFORE INSERT ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.ensure_pipeline_lead_default_stage();

-- 2. Garantir CASCADE em distribuicao_historico (idempotente; já existe mas reforçamos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distribuicao_historico_pipeline_lead_id_fkey'
      AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE public.distribuicao_historico
      DROP CONSTRAINT distribuicao_historico_pipeline_lead_id_fkey;
    ALTER TABLE public.distribuicao_historico
      ADD CONSTRAINT distribuicao_historico_pipeline_lead_id_fkey
      FOREIGN KEY (pipeline_lead_id) REFERENCES public.pipeline_leads(id) ON DELETE CASCADE;
  END IF;
END $$;
