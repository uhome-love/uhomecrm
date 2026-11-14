ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS gclid text;

CREATE OR REPLACE FUNCTION public._trg_pipeline_lead_gclid()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    IF NEW.gclid IS NULL AND NEW.dados_site IS NOT NULL THEN
      NEW.gclid := NULLIF(btrim(COALESCE(NEW.dados_site->>'gclid', NEW.dados_site->'utm'->>'gclid', NEW.dados_site->'tracking'->>'gclid')), '');
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pipeline_lead_gclid ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_lead_gclid BEFORE INSERT OR UPDATE OF dados_site, gclid ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public._trg_pipeline_lead_gclid();

CREATE TABLE public.google_ads_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL UNIQUE,
  visita_id uuid,
  gclid text NOT NULL,
  conversao_em timestamptz NOT NULL,
  valor numeric NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pendente',
  tentativas int NOT NULL DEFAULT 0,
  resposta jsonb,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_ads_conversoes TO service_role;
GRANT SELECT ON public.google_ads_conversoes TO authenticated;
ALTER TABLE public.google_ads_conversoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le conversoes google" ON public.google_ads_conversoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public._trg_visita_google_ads()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_gclid text;
BEGIN
  BEGIN
    IF NEW.pipeline_lead_id IS NOT NULL AND NEW.status = 'realizada'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      SELECT gclid INTO v_gclid FROM public.pipeline_leads WHERE id = NEW.pipeline_lead_id;
      IF v_gclid IS NOT NULL AND btrim(v_gclid) <> '' THEN
        INSERT INTO public.google_ads_conversoes (pipeline_lead_id, visita_id, gclid, conversao_em)
        VALUES (NEW.pipeline_lead_id, NEW.id, v_gclid,
          LEAST(now(), ((NEW.data_visita + COALESCE(NEW.hora_visita, '12:00'::time))::timestamp AT TIME ZONE 'America/Sao_Paulo')))
        ON CONFLICT (pipeline_lead_id) DO NOTHING;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '_trg_visita_google_ads: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_visita_google_ads ON public.visitas;
CREATE TRIGGER trg_visita_google_ads AFTER INSERT OR UPDATE OF status ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public._trg_visita_google_ads();