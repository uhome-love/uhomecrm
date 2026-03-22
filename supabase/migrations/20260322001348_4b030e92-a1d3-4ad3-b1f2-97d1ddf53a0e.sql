
-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_interesse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis_interesse ENABLE ROW LEVEL SECURITY;

-- Policies service_role
CREATE POLICY "service_role_all" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.oportunidades FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.perfil_interesse FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.imoveis_interesse FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies authenticated read
CREATE POLICY "auth_read" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON public.oportunidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON public.perfil_interesse FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON public.imoveis_interesse FOR SELECT TO authenticated USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads', 'oportunidades', 'perfil_interesse'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I; CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- Campos extras em profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'de_plantao') THEN
    ALTER TABLE public.profiles ADD COLUMN de_plantao boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'ativo') THEN
    ALTER TABLE public.profiles ADD COLUMN ativo boolean DEFAULT true;
  END IF;
END $$;
