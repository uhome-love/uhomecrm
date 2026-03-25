
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Anyone can read active properties'
  ) THEN
    CREATE POLICY "Anyone can read active properties"
      ON public.properties FOR SELECT TO anon
      USING (ativo = true);
  END IF;
END $$;
