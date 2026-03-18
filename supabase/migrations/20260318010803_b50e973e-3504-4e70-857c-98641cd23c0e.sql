
CREATE TABLE public.whatsapp_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  nome text,
  mensagem text,
  tipo text NOT NULL DEFAULT 'texto',
  payload_raw jsonb,
  campanha text,
  form_phone text,
  form_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_respostas ENABLE ROW LEVEL SECURITY;

-- Admins can read all responses
CREATE POLICY "Admins can read whatsapp_respostas"
ON public.whatsapp_respostas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);

-- Service role inserts via edge function (no authenticated insert needed)
-- The edge function uses service_role key which bypasses RLS

CREATE INDEX idx_whatsapp_respostas_phone ON public.whatsapp_respostas(phone);
CREATE INDEX idx_whatsapp_respostas_created ON public.whatsapp_respostas(created_at DESC);
