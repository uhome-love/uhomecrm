-- Anexos de documentos do candidato (RH). Bucket privado dedicado + tabela +
-- RLS espelhando a visibilidade do candidato (admin/rh tudo; gestor só nos seus;
-- diretor só leitura/baixar). Pasta do arquivo = candidato_id.
-- Já aplicada em produção em 13/08/2026; este arquivo mantém o repo como fonte.

-- 1) Bucket privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rh-candidato-docs','rh-candidato-docs', false, 20971520,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- 2) Tabela
CREATE TABLE IF NOT EXISTS public.rh_candidato_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid NOT NULL REFERENCES public.rh_candidatos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  path text NOT NULL,
  mime text,
  tamanho bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rh_candidato_anexos_cand_idx ON public.rh_candidato_anexos(candidato_id);
ALTER TABLE public.rh_candidato_anexos ENABLE ROW LEVEL SECURITY;

-- 3) RLS da tabela
DROP POLICY IF EXISTS "anexos select rh admin" ON public.rh_candidato_anexos;
CREATE POLICY "anexos select rh admin" ON public.rh_candidato_anexos FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role));
DROP POLICY IF EXISTS "anexos select diretor" ON public.rh_candidato_anexos;
CREATE POLICY "anexos select diretor" ON public.rh_candidato_anexos FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role));
DROP POLICY IF EXISTS "anexos select gestor own" ON public.rh_candidato_anexos;
CREATE POLICY "anexos select gestor own" ON public.rh_candidato_anexos FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
    SELECT 1 FROM public.rh_candidatos c WHERE c.id = rh_candidato_anexos.candidato_id AND c.gerente_id = auth.uid()));
DROP POLICY IF EXISTS "anexos insert rh admin" ON public.rh_candidato_anexos;
CREATE POLICY "anexos insert rh admin" ON public.rh_candidato_anexos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role));
DROP POLICY IF EXISTS "anexos insert gestor own" ON public.rh_candidato_anexos;
CREATE POLICY "anexos insert gestor own" ON public.rh_candidato_anexos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
    SELECT 1 FROM public.rh_candidatos c WHERE c.id = rh_candidato_anexos.candidato_id AND c.gerente_id = auth.uid()));
DROP POLICY IF EXISTS "anexos delete rh admin" ON public.rh_candidato_anexos;
CREATE POLICY "anexos delete rh admin" ON public.rh_candidato_anexos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role));
DROP POLICY IF EXISTS "anexos delete gestor own" ON public.rh_candidato_anexos;
CREATE POLICY "anexos delete gestor own" ON public.rh_candidato_anexos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
    SELECT 1 FROM public.rh_candidatos c WHERE c.id = rh_candidato_anexos.candidato_id AND c.gerente_id = auth.uid()));

-- 4) RLS do Storage (pasta = candidato_id)
DROP POLICY IF EXISTS "rh docs select" ON storage.objects;
CREATE POLICY "rh docs select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rh-candidato-docs' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role) OR has_role(auth.uid(),'diretor'::app_role)
    OR (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
      SELECT 1 FROM public.rh_candidatos c WHERE c.id::text = (storage.foldername(name))[1] AND c.gerente_id = auth.uid()))));
DROP POLICY IF EXISTS "rh docs insert" ON storage.objects;
CREATE POLICY "rh docs insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-candidato-docs' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role)
    OR (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
      SELECT 1 FROM public.rh_candidatos c WHERE c.id::text = (storage.foldername(name))[1] AND c.gerente_id = auth.uid()))));
DROP POLICY IF EXISTS "rh docs delete" ON storage.objects;
CREATE POLICY "rh docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rh-candidato-docs' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'rh'::app_role)
    OR (has_role(auth.uid(),'gestor'::app_role) AND EXISTS (
      SELECT 1 FROM public.rh_candidatos c WHERE c.id::text = (storage.foldername(name))[1] AND c.gerente_id = auth.uid()))));

-- 5) Realtime (badge de anexos ao vivo no kanban)
ALTER TABLE public.rh_candidato_anexos REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rh_candidato_anexos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_candidato_anexos;
  END IF;
END $$;
