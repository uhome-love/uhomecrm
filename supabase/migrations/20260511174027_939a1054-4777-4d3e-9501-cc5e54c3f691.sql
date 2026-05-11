-- Delay configurável entre mensagens
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS delay_min_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS delay_max_seconds integer NOT NULL DEFAULT 20;

-- Tabela de execuções do disparo
CREATE TABLE IF NOT EXISTS public.reengajamento_dispatch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running | completed | paused | error | timeout
  total_alvo integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  ultimo_lead_id uuid,
  ultimo_lead_nome text,
  motivo_parada text,
  erros jsonb DEFAULT '[]'::jsonb,
  iniciado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reeng_runs_started_at ON public.reengajamento_dispatch_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reeng_runs_status ON public.reengajamento_dispatch_runs(status);

ALTER TABLE public.reengajamento_dispatch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read runs" ON public.reengajamento_dispatch_runs FOR SELECT
  TO authenticated USING (true);

-- Tabela de eventos por lead
CREATE TABLE IF NOT EXISTS public.reengajamento_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  run_id uuid REFERENCES public.reengajamento_dispatch_runs(id) ON DELETE SET NULL,
  tipo text NOT NULL, -- enviado | telefone_invalido | falha_envio | resposta_recebida | classificado_sim | classificado_nao | classificado_outro | reativado_auto | reativado_manual
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reeng_eventos_lead ON public.reengajamento_eventos(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reeng_eventos_run ON public.reengajamento_eventos(run_id);
CREATE INDEX IF NOT EXISTS idx_reeng_eventos_tipo ON public.reengajamento_eventos(tipo, created_at DESC);

ALTER TABLE public.reengajamento_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read eventos" ON public.reengajamento_eventos FOR SELECT
  TO authenticated USING (true);