-- A1: índices de performance (sem mudança de comportamento)
CREATE INDEX IF NOT EXISTS idx_pl_ativos_updated
  ON public.pipeline_leads (updated_at DESC)
  WHERE arquivado = false;

CREATE INDEX IF NOT EXISTS idx_pl_corretor_ativo_updated
  ON public.pipeline_leads (corretor_id, updated_at DESC)
  WHERE arquivado = false;

CREATE INDEX IF NOT EXISTS idx_pl_corretor_distribuido
  ON public.pipeline_leads (corretor_id, distribuido_em);

CREATE INDEX IF NOT EXISTS idx_visitas_data_hora
  ON public.visitas (data_visita, hora_visita);

CREATE INDEX IF NOT EXISTS idx_pipeline_parcerias_status
  ON public.pipeline_parcerias (status);

CREATE INDEX IF NOT EXISTS idx_wa_msg_lead_ts
  ON public.whatsapp_mensagens (lead_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_historico_stage_created
  ON public.pipeline_historico (stage_novo_id, created_at);

ANALYZE public.pipeline_leads;
ANALYZE public.visitas;
ANALYZE public.pipeline_tarefas;
ANALYZE public.pipeline_historico;
ANALYZE public.whatsapp_mensagens;
ANALYZE public.pipeline_parcerias;