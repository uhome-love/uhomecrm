
-- Deduplicate Melnick Day leads: keep the most recent per email, discard older duplicates
-- First, identify the IDs to keep (most recent per email)
WITH ranked AS (
  SELECT id, email,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
  FROM pipeline_leads
  WHERE 'MELNICK_DAY' = ANY(tags)
  AND aceite_status != 'descartado'
  AND email IS NOT NULL
),
to_discard AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE pipeline_leads
SET aceite_status = 'descartado',
    observacoes = COALESCE(observacoes, '') || ' | Descartado automaticamente: lead duplicado Melnick Day'
WHERE id IN (SELECT id FROM to_discard);
