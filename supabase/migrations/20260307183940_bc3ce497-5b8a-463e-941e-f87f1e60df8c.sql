
-- 1. Add pipeline_lead_id to visitas table
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS pipeline_lead_id uuid REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

-- 2. Create trigger function to auto-move pipeline lead based on visit status
CREATE OR REPLACE FUNCTION public.visita_status_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage_id uuid;
  _stage_tipo text;
BEGIN
  -- Only act if there's a linked pipeline lead
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act on status changes
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map visit status to pipeline stage tipo
  CASE NEW.status
    WHEN 'marcada' THEN _stage_tipo := 'visita_marcada';
    WHEN 'confirmada' THEN _stage_tipo := 'visita_marcada';
    WHEN 'realizada' THEN _stage_tipo := 'visita_realizada';
    WHEN 'reagendada' THEN _stage_tipo := 'visita_marcada';
    WHEN 'no_show' THEN _stage_tipo := 'atendimento';
    WHEN 'cancelada' THEN _stage_tipo := 'atendimento';
    ELSE RETURN NEW;
  END CASE;

  -- Find the target stage
  SELECT id INTO _stage_id
  FROM public.pipeline_stages
  WHERE tipo = _stage_tipo AND ativo = true
  ORDER BY ordem LIMIT 1;

  IF _stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move the lead
  UPDATE public.pipeline_leads
  SET stage_id = _stage_id,
      stage_changed_at = now(),
      updated_at = now()
  WHERE id = NEW.pipeline_lead_id
    AND stage_id IS DISTINCT FROM _stage_id;

  -- Insert history record
  IF FOUND THEN
    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    SELECT NEW.pipeline_lead_id,
           pl.stage_id,
           _stage_id,
           COALESCE(NEW.created_by, auth.uid()),
           'Automático: visita ' || NEW.status
    FROM public.pipeline_leads pl
    WHERE pl.id = NEW.pipeline_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trg_visita_status_pipeline ON public.visitas;
CREATE TRIGGER trg_visita_status_pipeline
  AFTER INSERT OR UPDATE OF status ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION public.visita_status_to_pipeline();

-- 4. When creating a visit with pipeline_lead_id, auto-set to visita_marcada on INSERT
-- (already handled by the trigger above since INSERT fires it too)
