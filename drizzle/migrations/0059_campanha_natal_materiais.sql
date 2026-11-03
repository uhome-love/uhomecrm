CREATE TABLE public.natal_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text UNIQUE NOT NULL,
  secao text NOT NULL CHECK (secao IN ('cards','disparos','instagram','molduras','fotos','pdfs')),
  ordem int NOT NULL DEFAULT 0,
  titulo text NOT NULL,
  arquivo_path text NOT NULL,
  mime text,
  tamanho_bytes bigint,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.natal_materiais TO authenticated;
GRANT ALL ON public.natal_materiais TO service_role;
ALTER TABLE public.natal_materiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "natal_materiais_ler" ON public.natal_materiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "natal_materiais_inserir" ON public.natal_materiais FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "natal_materiais_alterar" ON public.natal_materiais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE POLICY "natal_materiais_apagar" ON public.natal_materiais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE POLICY "campanha_natal_ler" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'campanha-natal');
CREATE POLICY "campanha_natal_inserir" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campanha-natal' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')));
CREATE POLICY "campanha_natal_alterar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campanha-natal' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')));
CREATE POLICY "campanha_natal_apagar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campanha-natal' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')));

CREATE OR REPLACE FUNCTION public.natal_central_desagendar()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM cron.unschedule('natal-central-limpeza'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.natal_central_desagendar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.natal_central_desagendar() TO service_role;

SELECT cron.schedule(
  'natal-central-limpeza',
  '0 6 27 12 *',
  $cron$
  SELECT net.http_post(
    url := 'https://hunbxqzhvuemgntklyzb.supabase.co/functions/v1/natal-central-limpeza',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $cron$
);