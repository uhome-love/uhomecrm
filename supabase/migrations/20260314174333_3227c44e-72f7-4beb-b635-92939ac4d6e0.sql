-- Performance indexes for the two highest-cost KPI query paths
-- 1. v_kpi_ligacoes: eliminates seq scan on oferta_ativa_tentativas filtered by created_at
-- 2. v_kpi_gestao_leads: eliminates nested loop from pipeline_historico to pipeline_leads

CREATE INDEX IF NOT EXISTS idx_oa_tentativas_created_at
  ON public.oferta_ativa_tentativas (created_at);

CREATE INDEX IF NOT EXISTS idx_pipeline_historico_lead_id
  ON public.pipeline_historico (pipeline_lead_id);