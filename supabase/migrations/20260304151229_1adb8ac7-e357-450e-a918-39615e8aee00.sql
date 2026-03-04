
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  modulo text NOT NULL,
  acao text NOT NULL,
  chave_unica text,
  antes jsonb,
  depois jsonb,
  origem text DEFAULT 'manual',
  request_id text,
  descricao text
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores can view audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated users can insert audit log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_log_modulo ON public.audit_log (modulo);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
