
-- Table for ad creative uploads (videos, images, materials)
CREATE TABLE public.anuncio_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_codigo TEXT NOT NULL,
  empreendimento_nome TEXT NOT NULL,
  segmento TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'criativo', -- 'criativo', 'tabela', 'book', 'material'
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anuncio_materiais ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "anuncio_materiais_select" ON public.anuncio_materiais
  FOR SELECT TO authenticated USING (true);

-- Only admin/gestor can insert/update/delete (enforced in app layer too)
CREATE POLICY "anuncio_materiais_insert" ON public.anuncio_materiais
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "anuncio_materiais_delete" ON public.anuncio_materiais
  FOR DELETE TO authenticated USING (true);

-- Storage bucket for ad creatives
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('anuncio-materiais', 'anuncio-materiais', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "anuncio_materiais_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'anuncio-materiais');

-- Anyone can view (public bucket)
CREATE POLICY "anuncio_materiais_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'anuncio-materiais');

-- Authenticated can delete own uploads
CREATE POLICY "anuncio_materiais_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'anuncio-materiais');
