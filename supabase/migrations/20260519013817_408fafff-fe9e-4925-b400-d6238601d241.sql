CREATE INDEX IF NOT EXISTS idx_ops_events_fn_created_at
  ON public.ops_events (fn, created_at DESC);