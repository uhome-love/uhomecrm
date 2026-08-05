ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS ultimo_toque_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_ultimo_toque_at
  ON public.pipeline_leads (ultimo_toque_at DESC NULLS LAST);

ALTER TABLE public.pipeline_leads DISABLE TRIGGER trg_update_lead_ultima_acao;

DO $$
BEGIN
  UPDATE public.pipeline_leads l
  SET ultimo_toque_at = COALESCE(
    GREATEST(
      COALESCE((
        SELECT max(pa.created_at) FROM public.pipeline_atividades pa
        WHERE pa.pipeline_lead_id = l.id
          AND pa.created_by IS NOT NULL
          AND pa.tipo NOT IN ('entrada','nurturing_sequencia','sistema','mudanca_etapa','temperatura_mudou','pdn_risco','campanha_atrio','match','etapa')
      ), '-infinity'::timestamptz),
      COALESCE((
        SELECT max(pt.concluida_em) FROM public.pipeline_tarefas pt
        WHERE pt.pipeline_lead_id = l.id AND pt.status = 'concluida'
      ), '-infinity'::timestamptz),
      COALESCE(l.primeiro_contato_em, '-infinity'::timestamptz)
    ),
    l.created_at
  );
  UPDATE public.pipeline_leads
  SET ultimo_toque_at = created_at
  WHERE ultimo_toque_at = '-infinity'::timestamptz;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.pipeline_leads ENABLE TRIGGER trg_update_lead_ultima_acao;
  RAISE;
END $$;

ALTER TABLE public.pipeline_leads ENABLE TRIGGER trg_update_lead_ultima_acao;