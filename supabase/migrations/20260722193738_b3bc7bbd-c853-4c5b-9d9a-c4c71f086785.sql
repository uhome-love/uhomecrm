-- 1. Colunas aditivas em materiais_links
ALTER TABLE public.materiais_links
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS thumb_url text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'link';

ALTER TABLE public.materiais_links
  DROP CONSTRAINT IF EXISTS materiais_links_origem_check;
ALTER TABLE public.materiais_links
  ADD CONSTRAINT materiais_links_origem_check
  CHECK (origem IN ('link','upload'));

-- 2. Policies no bucket materiais-uhome
-- Gestor/admin: escrita e leitura completa
DROP POLICY IF EXISTS "materiais_uhome_gestor_insert" ON storage.objects;
CREATE POLICY "materiais_uhome_gestor_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'materiais-uhome'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

DROP POLICY IF EXISTS "materiais_uhome_gestor_update" ON storage.objects;
CREATE POLICY "materiais_uhome_gestor_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'materiais-uhome'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

DROP POLICY IF EXISTS "materiais_uhome_gestor_delete" ON storage.objects;
CREATE POLICY "materiais_uhome_gestor_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'materiais-uhome'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role))
  );

-- Leitura: qualquer autenticado (mesma regra da tabela materiais_links).
-- Público NUNCA lê direto; edge function pública usa service role pra assinar.
DROP POLICY IF EXISTS "materiais_uhome_auth_read" ON storage.objects;
CREATE POLICY "materiais_uhome_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'materiais-uhome');