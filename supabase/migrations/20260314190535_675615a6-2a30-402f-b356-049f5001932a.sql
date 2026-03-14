
-- =============================================================
-- Pipeline tables: add missing indexes to eliminate seq_scans
-- =============================================================

-- 1. pipeline_tarefas: heaviest offender (~146K seq_scans)
--    Polling queries filter by (responsavel_id, status) every 60s
CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_responsavel_status
  ON public.pipeline_tarefas (responsavel_id, status);

-- 2. pipeline_tarefas: lead detail loads tasks by lead id
CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_lead_id
  ON public.pipeline_tarefas (pipeline_lead_id);

-- 3. pipeline_atividades: lead timeline loads by lead + recent first
CREATE INDEX IF NOT EXISTS idx_pipeline_atividades_lead_created
  ON public.pipeline_atividades (pipeline_lead_id, created_at DESC);

-- 4. pipeline_anotacoes: lead notes loads by lead + recent first
CREATE INDEX IF NOT EXISTS idx_pipeline_anotacoes_lead_created
  ON public.pipeline_anotacoes (pipeline_lead_id, created_at DESC);
