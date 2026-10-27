CREATE OR REPLACE FUNCTION public.reset_ciclo_reentrada()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_old_descarte boolean;
  v_new_descarte boolean;
BEGIN
  SELECT tipo::text = 'descarte' INTO v_old_descarte FROM pipeline_stages WHERE id = OLD.stage_id;
  SELECT tipo::text = 'descarte' INTO v_new_descarte FROM pipeline_stages WHERE id = NEW.stage_id;

  IF NEW.arquivado = false AND COALESCE(v_new_descarte, false) = false AND (
       OLD.arquivado = true
       OR COALESCE(v_old_descarte, false)
       OR (OLD.estagnado = true AND NEW.estagnado IS NOT DISTINCT FROM OLD.estagnado AND NEW.corretor_id IS DISTINCT FROM OLD.corretor_id)
       OR NEW.reativado_em IS DISTINCT FROM OLD.reativado_em
       OR NEW.reaproveitado_em IS DISTINCT FROM OLD.reaproveitado_em
     ) THEN
    NEW.distribuido_em := now();
    NEW.ultimo_toque_at := NULL;
    NEW.estagnado := false;
    NEW.estagnado_em := NULL;
    NEW.estagnado_aviso_em := NULL;
    NEW.estagnado_aviso2_em := NULL;
    NEW.estagnado_prazo_em := NULL;
    NEW.estagnacao_carencia_ate := NULL;
    NEW.escalation_level := 0;
    NEW.last_escalation_at := NULL;
    NEW.reciclagem_aviso_at := NULL;
    NEW.stage_changed_at := now();
    -- Tarefas pendentes do ciclo antigo não podem deixar o lead "atrasado".
    UPDATE pipeline_tarefas SET status = 'cancelada'
     WHERE pipeline_lead_id = NEW.id AND status = 'pendente' AND created_at < now();
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- nunca derrubar a reativação
END $$;

DROP TRIGGER IF EXISTS trg_reset_ciclo_reentrada ON public.pipeline_leads;
CREATE TRIGGER trg_reset_ciclo_reentrada
BEFORE UPDATE ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.reset_ciclo_reentrada();

UPDATE public.pipeline_leads pl
SET ultimo_toque_at = NULL,
    estagnado = false, estagnado_em = NULL, estagnado_aviso_em = NULL,
    estagnado_aviso2_em = NULL, estagnado_prazo_em = NULL,
    escalation_level = 0, last_escalation_at = NULL, reciclagem_aviso_at = NULL
WHERE pl.arquivado = false
  AND pl.ultimo_toque_at < pl.distribuido_em
  AND EXISTS (SELECT 1 FROM public.pipeline_atividades a
              WHERE a.pipeline_lead_id = pl.id AND a.tipo = 'entrada'
                AND a.created_at > now() - interval '30 days');