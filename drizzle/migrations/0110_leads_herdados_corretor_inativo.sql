ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS herdado_de_corretor_id uuid,
  ADD COLUMN IF NOT EXISTS herdado_em timestamptz,
  ADD COLUMN IF NOT EXISTS herdado_decidido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_pipeline_leads_herdado_pendente
  ON public.pipeline_leads (corretor_id) WHERE herdado_de_corretor_id IS NOT NULL AND herdado_decidido_em IS NULL;

CREATE OR REPLACE FUNCTION public.trg_lead_herdado_corretor_inativo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text;
BEGIN
  IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
    IF OLD.corretor_id IS NOT NULL AND NEW.corretor_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = OLD.corretor_id AND p.ativo = false
    ) THEN
      NEW.herdado_de_corretor_id := OLD.corretor_id;
      NEW.herdado_em := now();
      NEW.herdado_decidido_em := NULL;
    ELSIF NEW.herdado_de_corretor_id IS NOT NULL AND NEW.herdado_decidido_em IS NULL THEN
      NEW.herdado_decidido_em := now();
    END IF;
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id
        AND NEW.herdado_de_corretor_id IS NOT NULL AND NEW.herdado_decidido_em IS NULL THEN
    SELECT tipo::text INTO v_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF v_tipo = 'descarte' THEN NEW.herdado_decidido_em := now(); END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS b_lead_herdado_corretor_inativo ON public.pipeline_leads;
CREATE TRIGGER b_lead_herdado_corretor_inativo
  BEFORE UPDATE OF corretor_id, stage_id ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_lead_herdado_corretor_inativo();

CREATE OR REPLACE FUNCTION public.decidir_lead_herdado_manter(p_lead_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_de uuid; v_nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access_lead(p_lead_id) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;
  UPDATE public.pipeline_leads SET herdado_decidido_em = now()
   WHERE id = p_lead_id AND herdado_de_corretor_id IS NOT NULL AND herdado_decidido_em IS NULL
   RETURNING herdado_de_corretor_id INTO v_de;
  IF v_de IS NULL THEN RETURN false; END IF;
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = v_de;
  INSERT INTO public.pipeline_anotacoes (pipeline_lead_id, autor_id, conteudo)
  VALUES (p_lead_id, auth.uid(), 'Lead herdado de ' || coalesce(v_nome,'corretor inativo') || ': mantido com o responsável atual.');
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.decidir_lead_herdado_manter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_lead_herdado_manter(uuid) TO authenticated;