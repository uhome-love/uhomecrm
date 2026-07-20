
CREATE OR REPLACE FUNCTION public.trg_clear_negocio_on_stage_regress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ordem INT;
  new_tipo TEXT;
  old_ordem INT;
BEGIN
  SELECT ordem, tipo INTO new_ordem, new_tipo
  FROM public.pipeline_stages WHERE id = NEW.stage_id;

  SELECT ordem INTO old_ordem
  FROM public.pipeline_stages WHERE id = OLD.stage_id;

  IF new_ordem IS NULL OR new_ordem >= 5 THEN RETURN NEW; END IF;
  IF new_tipo IN ('descarte','ganho','caiu') THEN RETURN NEW; END IF;
  IF old_ordem IS NULL OR old_ordem < 5 THEN RETURN NEW; END IF;

  NEW.flag_status := COALESCE(NEW.flag_status,'{}'::jsonb) - 'status_negociacao' - 'status_contrato';

  IF NEW.negocio_id IS NOT NULL THEN
    UPDATE public.negocios
       SET status='arquivado', updated_at=now()
     WHERE id = NEW.negocio_id AND status='ativo';
    NEW.negocio_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_negocio_on_stage_regress ON public.pipeline_leads;
CREATE TRIGGER trg_clear_negocio_on_stage_regress
BEFORE UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.trg_clear_negocio_on_stage_regress();

-- BACKFILL
UPDATE public.negocios n
   SET status='arquivado', updated_at=now()
  FROM public.pipeline_leads l
  JOIN public.pipeline_stages s ON s.id = l.stage_id
 WHERE n.id = l.negocio_id
   AND n.status='ativo'
   AND s.ordem < 5
   AND s.tipo NOT IN ('descarte','ganho','caiu');

UPDATE public.pipeline_leads l
   SET flag_status = COALESCE(l.flag_status,'{}'::jsonb) - 'status_negociacao' - 'status_contrato',
       negocio_id = NULL
  FROM public.pipeline_stages s
 WHERE s.id = l.stage_id
   AND s.ordem < 5
   AND s.tipo NOT IN ('descarte','ganho','caiu')
   AND (l.flag_status ? 'status_negociacao'
        OR l.flag_status ? 'status_contrato'
        OR l.negocio_id IS NOT NULL);
