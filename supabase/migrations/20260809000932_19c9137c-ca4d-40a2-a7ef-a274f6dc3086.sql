CREATE OR REPLACE FUNCTION public.trg_ia_apresentacao_capi()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aceite_novo boolean := (NEW.aceite_em IS NOT NULL)
    AND (TG_OP = 'INSERT' OR OLD.aceite_em IS NULL);
  v_data_nova boolean := (NEW.confirmada_em IS NOT NULL)
    AND (TG_OP = 'INSERT' OR OLD.confirmada_em IS NULL);
BEGIN
  IF v_aceite_novo THEN
    BEGIN
      PERFORM public.enqueue_meta_capi_event_lia(
        p_ia_lead_id => NEW.ia_lead_id,
        p_event_name => 'LeadQualificado'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Grava, nao engole: falha de CAPI nao derruba a escrita do negocio,
      -- mas conversao quebrada em silencio deixa o painel verde para sempre.
      INSERT INTO public.ops_events (fn, level, category, message, ctx)
      VALUES ('ia-apresentacao-capi', 'error', 'capi',
              'falha ao enfileirar LeadQualificado',
              jsonb_build_object('apresentacao_id', NEW.id,
                                 'ia_lead_id', NEW.ia_lead_id,
                                 'erro', SQLERRM));
    END;
  END IF;

  IF v_data_nova THEN
    BEGIN
      PERFORM public.enqueue_meta_capi_event_lia(
        p_ia_lead_id => NEW.ia_lead_id,
        p_event_name => 'VisitaMarcada'
      );
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.ops_events (fn, level, category, message, ctx)
      VALUES ('ia-apresentacao-capi', 'error', 'capi',
              'falha ao enfileirar VisitaMarcada',
              jsonb_build_object('apresentacao_id', NEW.id,
                                 'ia_lead_id', NEW.ia_lead_id,
                                 'erro', SQLERRM));
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ia_apresentacao_capi_ins ON public.ia_apresentacoes;
CREATE TRIGGER trg_ia_apresentacao_capi_ins
AFTER INSERT ON public.ia_apresentacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_ia_apresentacao_capi();

DROP TRIGGER IF EXISTS trg_ia_apresentacao_capi_upd ON public.ia_apresentacoes;
CREATE TRIGGER trg_ia_apresentacao_capi_upd
AFTER UPDATE OF aceite_em, confirmada_em ON public.ia_apresentacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_ia_apresentacao_capi();