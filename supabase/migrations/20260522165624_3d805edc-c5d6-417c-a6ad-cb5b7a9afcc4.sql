CREATE OR REPLACE FUNCTION public.cancel_pipeline_tasks_on_lead_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_stage_tipo TEXT;
  v_new_stage_tipo TEXT;
  v_should_cancel BOOLEAN := false;
  v_motivo TEXT;
BEGIN
  IF NEW.arquivado = true AND COALESCE(OLD.arquivado, false) = false THEN
    v_should_cancel := true;
    v_motivo := 'lead arquivado';
  END IF;

  IF NEW.negocio_id IS NOT NULL AND OLD.negocio_id IS NULL THEN
    v_should_cancel := true;
    v_motivo := COALESCE(v_motivo, 'lead virou negócio');
  END IF;

  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT tipo INTO v_new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
    SELECT tipo INTO v_old_stage_tipo FROM public.pipeline_stages WHERE id = OLD.stage_id;
    IF v_new_stage_tipo = 'descarte' AND COALESCE(v_old_stage_tipo, '') <> 'descarte' THEN
      v_should_cancel := true;
      v_motivo := COALESCE(v_motivo, 'lead movido para descarte');
    END IF;
  END IF;

  IF v_should_cancel THEN
    UPDATE public.pipeline_tarefas
    SET status = 'cancelada',
        concluida_em = now(),
        descricao = COALESCE(descricao, '') || E'\n[Auto-cancelada: ' || v_motivo || ']'
    WHERE pipeline_lead_id = NEW.id
      AND status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_tasks_on_lead_close ON public.pipeline_leads;
CREATE TRIGGER trg_cancel_tasks_on_lead_close
AFTER UPDATE ON public.pipeline_leads
FOR EACH ROW
WHEN (
  (NEW.arquivado IS DISTINCT FROM OLD.arquivado)
  OR (NEW.stage_id IS DISTINCT FROM OLD.stage_id)
  OR (NEW.negocio_id IS DISTINCT FROM OLD.negocio_id)
)
EXECUTE FUNCTION public.cancel_pipeline_tasks_on_lead_close();