CREATE TABLE public.auth_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  session_id text,
  event_type text NOT NULL,
  origin text,
  reason text,
  raw_len int,
  storage_key text,
  build_hash text,
  user_agent text,
  ip inet,
  extra jsonb
);

CREATE INDEX idx_auth_telemetry_created_at ON public.auth_telemetry (created_at DESC);
CREATE INDEX idx_auth_telemetry_event_created ON public.auth_telemetry (event_type, created_at DESC);
CREATE INDEX idx_auth_telemetry_user_created ON public.auth_telemetry (user_id, created_at DESC);

ALTER TABLE public.auth_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert auth telemetry"
ON public.auth_telemetry
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admin can view auth telemetry"
ON public.auth_telemetry
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.auth_telemetry IS 'Auth event sink for investigation. Retain ~30 days. Phase 2 of auth instability fix.';