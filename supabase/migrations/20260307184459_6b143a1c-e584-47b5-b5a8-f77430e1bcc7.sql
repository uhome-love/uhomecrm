
-- 1. Add resultado_visita column to visitas
ALTER TABLE public.visitas ADD COLUMN IF NOT EXISTS resultado_visita text;

-- 2. Update the trigger to also handle resultado_visita mapping to pipeline
CREATE OR REPLACE FUNCTION public.visita_status_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage_id uuid;
  _stage_tipo text;
  _old_stage_id uuid;
BEGIN
  -- Only act if there's a linked pipeline lead
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current stage of the lead for history
  SELECT stage_id INTO _old_stage_id
  FROM public.pipeline_leads
  WHERE id = NEW.pipeline_lead_id;

  -- If resultado_visita changed (post-visit result), use it to determine stage
  IF NEW.resultado_visita IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.resultado_visita IS DISTINCT FROM NEW.resultado_visita) THEN
    CASE NEW.resultado_visita
      WHEN 'gostou_quer_proposta' THEN _stage_tipo := 'negociacao';
      WHEN 'gostou_vai_pensar' THEN _stage_tipo := 'negociacao';
      WHEN 'nao_gostou' THEN _stage_tipo := 'descarte';
      WHEN 'nao_compareceu' THEN _stage_tipo := 'atendimento';
      WHEN 'reagendar' THEN _stage_tipo := 'visita_marcada';
      WHEN 'quer_ver_outro' THEN _stage_tipo := 'qualificacao';
      ELSE _stage_tipo := 'visita_realizada';
    END CASE;
  -- Otherwise check status changes
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'marcada' THEN _stage_tipo := 'visita_marcada';
      WHEN 'confirmada' THEN _stage_tipo := 'visita_marcada';
      WHEN 'realizada' THEN _stage_tipo := 'visita_realizada';
      WHEN 'reagendada' THEN _stage_tipo := 'visita_marcada';
      WHEN 'no_show' THEN _stage_tipo := 'atendimento';
      WHEN 'cancelada' THEN _stage_tipo := 'atendimento';
      ELSE RETURN NEW;
    END CASE;
  ELSIF TG_OP = 'INSERT' THEN
    CASE NEW.status
      WHEN 'marcada' THEN _stage_tipo := 'visita_marcada';
      ELSE RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  -- Find the target stage
  SELECT id INTO _stage_id
  FROM public.pipeline_stages
  WHERE tipo = _stage_tipo AND ativo = true
  ORDER BY ordem LIMIT 1;

  IF _stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Move the lead only if stage actually changes
  UPDATE public.pipeline_leads
  SET stage_id = _stage_id,
      stage_changed_at = now(),
      updated_at = now()
  WHERE id = NEW.pipeline_lead_id
    AND stage_id IS DISTINCT FROM _stage_id;

  -- Insert history record if lead was moved
  IF FOUND AND _old_stage_id IS DISTINCT FROM _stage_id THEN
    INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
    VALUES (
      NEW.pipeline_lead_id,
      _old_stage_id,
      _stage_id,
      COALESCE(NEW.created_by, auth.uid()),
      CASE 
        WHEN NEW.resultado_visita IS NOT NULL THEN 'Resultado visita: ' || NEW.resultado_visita
        ELSE 'Automático: visita ' || NEW.status
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Recreate trigger to also fire on resultado_visita changes
DROP TRIGGER IF EXISTS trg_visita_status_pipeline ON public.visitas;
CREATE TRIGGER trg_visita_status_pipeline
  AFTER INSERT OR UPDATE OF status, resultado_visita ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION public.visita_status_to_pipeline();
