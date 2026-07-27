-- ============================================================
-- Fase 1: Ativa "The Arch" + aliases Meta (tipo=formulario)
-- ============================================================
UPDATE public.empreendimentos_canonicos
SET ativo = true, updated_at = now()
WHERE nome = 'The Arch';

INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo)
SELECT lower(btrim(a.raw)), a.raw, e.id, 'formulario'
FROM public.empreendimentos_canonicos e
CROSS JOIN (VALUES
  ('The Arch'),
  ('The Arch - IG'),
  ('The Arch – IG'),
  ('The Arch IG'),
  ('The Arch - FB'),
  ('The Arch FB'),
  ('Arch'),
  ('Uhome - The Arch'),
  ('Uhome The Arch'),
  ('the_arch'),
  ('thearch')
) AS a(raw)
WHERE e.nome = 'The Arch'
ON CONFLICT (alias_norm, tipo) DO NOTHING;

-- Também como empreendimento_texto (usado pelo matcher IA)
INSERT INTO public.empreendimento_aliases (alias_norm, alias_raw, empreendimento_id, tipo)
SELECT lower(btrim(a.raw)), a.raw, e.id, 'empreendimento_texto'
FROM public.empreendimentos_canonicos e
CROSS JOIN (VALUES
  ('The Arch'),
  ('Arch'),
  ('the arch'),
  ('the_arch')
) AS a(raw)
WHERE e.nome = 'The Arch'
ON CONFLICT (alias_norm, tipo) DO NOTHING;

-- ============================================================
-- Fase 2.1: Colunas de rastreamento granular em pipeline_leads
-- ============================================================
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS adset_id   text,
  ADD COLUMN IF NOT EXISTS ad_id      text,
  ADD COLUMN IF NOT EXISTS form_id    text,
  ADD COLUMN IF NOT EXISTS form_name  text,
  ADD COLUMN IF NOT EXISTS placement  text,
  ADD COLUMN IF NOT EXISTS ad_format  text;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_adset_id   ON public.pipeline_leads (adset_id) WHERE adset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_ad_id      ON public.pipeline_leads (ad_id)    WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_form_id    ON public.pipeline_leads (form_id)  WHERE form_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_placement  ON public.pipeline_leads (placement) WHERE placement IS NOT NULL;

-- Backfill leve de form_name via meta_form_names (só onde estiver NULL)
UPDATE public.pipeline_leads pl
SET form_name = mfn.form_name
FROM public.meta_form_names mfn
WHERE pl.form_id IS NOT NULL
  AND pl.form_name IS NULL
  AND mfn.form_id = pl.form_id;