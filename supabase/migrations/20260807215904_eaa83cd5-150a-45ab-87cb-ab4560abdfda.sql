-- Backup das linhas que serão removidas na deduplicação
CREATE TABLE IF NOT EXISTS public._pdn_entries_backup_passo2 (LIKE public.pdn_entries);
GRANT ALL ON public._pdn_entries_backup_passo2 TO service_role;
ALTER TABLE public._pdn_entries_backup_passo2 ENABLE ROW LEVEL SECURITY;

-- 1) Backfill: notas com negocio_id mas sem pipeline_lead_id
UPDATE public.pdn_entries p
SET pipeline_lead_id = n.pipeline_lead_id
FROM public.negocios n
WHERE p.negocio_id = n.id
  AND p.pipeline_lead_id IS NULL
  AND n.pipeline_lead_id IS NOT NULL;

-- 2) Deduplicação por (pipeline_lead_id, mes): mantém a mais recente
INSERT INTO public._pdn_entries_backup_passo2
SELECT * FROM public.pdn_entries p
WHERE p.pipeline_lead_id IS NOT NULL
  AND p.id NOT IN (
    SELECT DISTINCT ON (pipeline_lead_id, mes) id
    FROM public.pdn_entries
    WHERE pipeline_lead_id IS NOT NULL
    ORDER BY pipeline_lead_id, mes, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  );

DELETE FROM public.pdn_entries p
WHERE p.pipeline_lead_id IS NOT NULL
  AND p.id NOT IN (
    SELECT DISTINCT ON (pipeline_lead_id, mes) id
    FROM public.pdn_entries
    WHERE pipeline_lead_id IS NOT NULL
    ORDER BY pipeline_lead_id, mes, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  );

-- 3) Chave única parcial
CREATE UNIQUE INDEX IF NOT EXISTS pdn_entries_lead_mes_uidx
  ON public.pdn_entries (pipeline_lead_id, mes)
  WHERE pipeline_lead_id IS NOT NULL;

-- 4) FKs canônicas
ALTER TABLE public.pdn_entries
  DROP CONSTRAINT IF EXISTS pdn_entries_pipeline_lead_id_fkey,
  ADD CONSTRAINT pdn_entries_pipeline_lead_id_fkey
    FOREIGN KEY (pipeline_lead_id) REFERENCES public.pipeline_leads(id) ON DELETE CASCADE;

ALTER TABLE public.pdn_entries
  DROP CONSTRAINT IF EXISTS pdn_entries_negocio_id_fkey,
  ADD CONSTRAINT pdn_entries_negocio_id_fkey
    FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE SET NULL;