CREATE OR REPLACE FUNCTION public.trg_site_nao_tira_corretor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.corretor_id IS NOT NULL AND OLD.aceite_status = 'aceito'
     AND NEW.corretor_id IS NULL
     AND NEW.motivo_pendencia = 'fila_ceo_site' THEN
    NEW.corretor_id := OLD.corretor_id;
    NEW.aceite_status := OLD.aceite_status;
    NEW.stage_id := OLD.stage_id;
    NEW.motivo_pendencia := OLD.motivo_pendencia;
    IF OLD.observacoes IS NOT NULL AND NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN
      NEW.observacoes := OLD.observacoes || E'\n---\n' || COALESCE(NEW.observacoes, '');
    END IF;
    BEGIN
      INSERT INTO public.ops_events(fn, level, category, message, ctx)
      VALUES ('trg_site_nao_tira_corretor','warn','business','Site tentou tirar corretor de lead aceito',
              jsonb_build_object('lead_id', OLD.id, 'corretor_id', OLD.corretor_id));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_site_nao_tira_corretor ON public.pipeline_leads;
CREATE TRIGGER a_site_nao_tira_corretor BEFORE UPDATE ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_site_nao_tira_corretor();