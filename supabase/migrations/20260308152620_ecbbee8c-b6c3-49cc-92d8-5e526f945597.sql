CREATE TABLE IF NOT EXISTS public.cobrancas_enviadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enviado_por UUID NOT NULL,
  tipo TEXT NOT NULL,
  destinatarios JSONB DEFAULT '[]'::jsonb,
  mensagem TEXT,
  leads_afetados JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cobrancas_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores e admins podem inserir cobrancas"
  ON public.cobrancas_enviadas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = enviado_por);

CREATE POLICY "Gestores e admins podem ver suas cobrancas"
  ON public.cobrancas_enviadas FOR SELECT
  TO authenticated
  USING (auth.uid() = enviado_por);