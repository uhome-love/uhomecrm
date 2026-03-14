
-- Index 1: Accelerates v_kpi_negocios partnership lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_parcerias_lead_status
ON public.pipeline_parcerias (pipeline_lead_id, status);

-- Index 2: Accelerates v_kpi_gestao_leads time-range scans
CREATE INDEX IF NOT EXISTS idx_pipeline_historico_created_stage
ON public.pipeline_historico (created_at, stage_novo_id);

-- Index 3: Accelerates negocios JOIN to pipeline_leads
CREATE INDEX IF NOT EXISTS idx_negocios_pipeline_lead_id
ON public.negocios (pipeline_lead_id);

-- Index 4: Accelerates notification queries (filtered by type, user, sorted by date)
CREATE INDEX IF NOT EXISTS idx_notifications_tipo_user_created
ON public.notifications (tipo, user_id, created_at DESC);
