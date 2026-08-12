ALTER TABLE public.rh_candidatos REPLICA IDENTITY FULL;
ALTER TABLE public.rh_entrevistas REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rh_candidatos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_candidatos;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rh_entrevistas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_entrevistas;
  END IF;
END $$;