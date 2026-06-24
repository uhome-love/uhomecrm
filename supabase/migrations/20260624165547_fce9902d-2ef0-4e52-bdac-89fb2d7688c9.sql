-- Lista de supressão de números para disparos Meta
CREATE TABLE public.meta_supressao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone text NOT NULL,
  telefone_last8 text NOT NULL,
  codigo text,
  motivo text NOT NULL,
  template_name text,
  suprimir_ate timestamptz, -- null = permanente
  ocorrencias integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Um número aparece uma vez; atualizamos motivo/ocorrências em conflito
CREATE UNIQUE INDEX meta_supressao_last8_key ON public.meta_supressao (telefone_last8);
CREATE INDEX idx_meta_supressao_suprimir_ate ON public.meta_supressao (suprimir_ate);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_supressao TO authenticated;
GRANT ALL ON public.meta_supressao TO service_role;

ALTER TABLE public.meta_supressao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/gestor read meta supressao"
ON public.meta_supressao FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meta_supressao_updated_at
BEFORE UPDATE ON public.meta_supressao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();