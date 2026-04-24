-- Tabela de empreendimentos da página Materiais
CREATE TABLE public.materiais_empreendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  empreendimento_ref TEXT NULL,
  logo_url TEXT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de links/materiais por empreendimento
CREATE TABLE public.materiais_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empreendimento_id UUID NOT NULL REFERENCES public.materiais_empreendimentos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  descricao TEXT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_materiais_links_empreendimento ON public.materiais_links(empreendimento_id);

-- Trigger de updated_at
CREATE TRIGGER update_materiais_empreendimentos_updated_at
  BEFORE UPDATE ON public.materiais_empreendimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_materiais_links_updated_at
  BEFORE UPDATE ON public.materiais_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.materiais_empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais_links ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado
CREATE POLICY "Materiais visíveis a autenticados"
  ON public.materiais_empreendimentos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Links visíveis a autenticados"
  ON public.materiais_links FOR SELECT
  TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: somente gestor ou admin
CREATE POLICY "Gestor/admin gerenciam empreendimentos (insert)"
  ON public.materiais_empreendimentos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor/admin gerenciam empreendimentos (update)"
  ON public.materiais_empreendimentos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor/admin gerenciam empreendimentos (delete)"
  ON public.materiais_empreendimentos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor/admin gerenciam links (insert)"
  ON public.materiais_links FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor/admin gerenciam links (update)"
  ON public.materiais_links FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor/admin gerenciam links (delete)"
  ON public.materiais_links FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Storage bucket público para logos dos empreendimentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('materiais-logos', 'materiais-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Logos materiais públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materiais-logos');

CREATE POLICY "Gestor/admin upload logos materiais"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'materiais-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE POLICY "Gestor/admin atualiza logos materiais"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'materiais-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  );

CREATE POLICY "Gestor/admin deleta logos materiais"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'materiais-logos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  );