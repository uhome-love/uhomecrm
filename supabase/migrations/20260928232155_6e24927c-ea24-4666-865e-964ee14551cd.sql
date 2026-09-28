CREATE TABLE public.pagina_empreendimento_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_slug text NOT NULL,
  form_ref text,
  telefone_digitado text NOT NULL,
  telefone_normalizado text,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  periodo_visita text NOT NULL,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  ip_hash text,
  status text NOT NULL DEFAULT 'pendente',
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pagina_empreendimento_respostas TO service_role;
GRANT SELECT ON public.pagina_empreendimento_respostas TO authenticated;

ALTER TABLE public.pagina_empreendimento_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e diretor leem respostas"
ON public.pagina_empreendimento_respostas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE INDEX idx_pag_resp_tel ON public.pagina_empreendimento_respostas (telefone_normalizado, created_at DESC);
CREATE INDEX idx_pag_resp_ip ON public.pagina_empreendimento_respostas (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_pagina_resp_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.telefone_normalizado := public.normalize_telefone(NEW.telefone_digitado);
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER pagina_resp_normalize
BEFORE INSERT OR UPDATE ON public.pagina_empreendimento_respostas
FOR EACH ROW EXECUTE FUNCTION public.trg_pagina_resp_normalize();