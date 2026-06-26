CREATE TABLE public.reengajamento_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.reengajamento_dispatch_runs(id) ON DELETE CASCADE,
  lead_id uuid,
  lead_ref text NOT NULL CHECK (lead_ref IN ('pipeline_lead', 'oferta_ativa_lead')),
  nome text,
  telefone text,
  email text,
  phone_normalized text,
  phone_last8 text NOT NULL,
  template_name text,
  template_language text DEFAULT 'pt_BR',
  audience_source text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'suppressed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamp with time zone,
  processed_at timestamp with time zone,
  error_text text,
  wamid text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (run_id, phone_last8, template_name)
);

GRANT SELECT ON public.reengajamento_dispatch_queue TO authenticated;
GRANT ALL ON public.reengajamento_dispatch_queue TO service_role;

ALTER TABLE public.reengajamento_dispatch_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reengagement queue"
ON public.reengajamento_dispatch_queue
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service role can manage reengagement queue"
ON public.reengajamento_dispatch_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_reengajamento_dispatch_queue_run_status
ON public.reengajamento_dispatch_queue (run_id, status, created_at);

CREATE INDEX idx_reengajamento_dispatch_queue_phone_template
ON public.reengajamento_dispatch_queue (phone_last8, template_name, status);

CREATE OR REPLACE FUNCTION public.update_reengajamento_dispatch_queue_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_reengajamento_dispatch_queue_updated_at
BEFORE UPDATE ON public.reengajamento_dispatch_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_reengajamento_dispatch_queue_updated_at();