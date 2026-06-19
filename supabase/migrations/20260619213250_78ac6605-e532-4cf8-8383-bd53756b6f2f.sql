CREATE TABLE public.intermediacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  comprador_nome text NOT NULL,
  tipo_pessoa text NOT NULL,
  empreendimento text NOT NULL,
  unidade text NOT NULL,
  vgv numeric NOT NULL,
  valor_comissao numeric NOT NULL,
  corretores text[] NOT NULL,
  arquivo_path text NOT NULL,
  filename text NOT NULL
);

GRANT SELECT, INSERT ON public.intermediacoes TO authenticated;
GRANT ALL ON public.intermediacoes TO service_role;

ALTER TABLE public.intermediacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_gestor_select_intermediacoes"
ON public.intermediacoes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "admin_gestor_insert_intermediacoes"
ON public.intermediacoes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Storage policies for the private "intermediacoes" bucket
CREATE POLICY "admin_gestor_select_storage_intermediacoes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'intermediacoes'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);

CREATE POLICY "admin_gestor_insert_storage_intermediacoes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intermediacoes'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
);