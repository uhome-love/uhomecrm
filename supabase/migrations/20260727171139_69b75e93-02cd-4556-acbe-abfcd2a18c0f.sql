-- Reverter data_visita dos backfills de Pós-Visita para a data real de entrada na etapa.
-- Os 22 registros foram criados hoje (27/07/2026) mas representam visitas que aconteceram antes.
UPDATE public.visitas v
SET data_visita = COALESCE(
      -- 1ª escolha: data em que o lead entrou na etapa Pós-Visita, se anterior a hoje
      CASE WHEN pl.stage_changed_at::date < CURRENT_DATE THEN pl.stage_changed_at::date END,
      -- 2ª escolha: 1 dia antes do último update do lead, se anterior a hoje
      CASE WHEN pl.updated_at::date < CURRENT_DATE THEN (pl.updated_at::date - INTERVAL '1 day')::date END,
      -- Fallback final: ontem
      (CURRENT_DATE - INTERVAL '1 day')::date
    ),
    updated_at = now()
FROM public.pipeline_leads pl
WHERE v.pipeline_lead_id = pl.id
  AND v.origem = 'backfill_pos_visita'
  AND v.created_at::date = DATE '2026-07-27'
  AND v.data_visita = DATE '2026-07-27';