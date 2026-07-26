
-- 1) Colunas de warm-up e pacing em reengajamento_config
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS warmup_started_at date,
  ADD COLUMN IF NOT EXISTS warmup_pausado_ate date,
  ADD COLUMN IF NOT EXISTS ultimo_envio_at timestamptz;

COMMENT ON COLUMN public.reengajamento_config.warmup_started_at IS 'Data (BRT) em que o warm-up começou. NULL = sem warm-up ativo, cap = daily_limit.';
COMMENT ON COLUMN public.reengajamento_config.warmup_pausado_ate IS 'Se auto-pausa disparar, congela o ramp até esta data (BRT).';
COMMENT ON COLUMN public.reengajamento_config.ultimo_envio_at IS 'Timestamp do último envio bem-sucedido pelo worker (para pacing entre invocações do cron).';

-- 2) Heartbeat do worker (single-row via id fixo)
CREATE TABLE IF NOT EXISTS public.reengajamento_worker_heartbeat (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  last_run_at timestamptz,
  last_status text,
  last_reason text,
  last_batch_size integer,
  last_sent integer,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reengajamento_worker_heartbeat TO authenticated;
GRANT ALL ON public.reengajamento_worker_heartbeat TO service_role;

ALTER TABLE public.reengajamento_worker_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores leem heartbeat"
  ON public.reengajamento_worker_heartbeat
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 3) Cap do dia com ramp de warm-up
CREATE OR REPLACE FUNCTION public.cap_do_dia()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg          public.reengajamento_config%ROWTYPE;
  v_today        date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dias         integer;
  v_ramp         numeric;
  v_cap          integer;
BEGIN
  SELECT * INTO v_cfg FROM public.reengajamento_config LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_cfg.warmup_started_at IS NULL THEN
    RETURN v_cfg.daily_limit;
  END IF;

  -- Se auto-pausa segura o ramp, usa o dia anterior à data pausada
  IF v_cfg.warmup_pausado_ate IS NOT NULL AND v_cfg.warmup_pausado_ate > v_today THEN
    v_dias := GREATEST(v_cfg.warmup_pausado_ate - v_cfg.warmup_started_at - 1, 0);
  ELSE
    v_dias := GREATEST(v_today - v_cfg.warmup_started_at, 0);
  END IF;

  v_ramp := power(1 + (v_cfg.warmup_incremento_pct::numeric / 100.0), v_dias);
  v_cap  := floor(v_cfg.warmup_inicial * v_ramp)::integer;
  RETURN LEAST(v_cap, v_cfg.daily_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cap_do_dia() TO authenticated, service_role;

-- 4) Total enviado hoje (BRT), somando TODOS os runs
CREATE OR REPLACE FUNCTION public.enviados_hoje_reengajamento()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.reengajamento_dispatch_queue
  WHERE status = 'sent'
    AND (processed_at AT TIME ZONE 'America/Sao_Paulo')::date
      = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

GRANT EXECUTE ON FUNCTION public.enviados_hoje_reengajamento() TO authenticated, service_role;
