CREATE OR REPLACE FUNCTION public.reset_ciclo_reentrada()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_old_descarte boolean;
  v_new_descarte boolean;
  n int;
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
    UPDATE pipeline_tarefas SET status = 'cancelada'
     WHERE pipeline_lead_id = NEW.id AND status = 'pendente' AND created_at < now();
    -- Lead que volta ao pipeline entra limpo de parceria.
    BEGIN
      UPDATE pipeline_parcerias
         SET status = 'encerrada', encerrada_em = now(), updated_at = now(),
             motivo = COALESCE(motivo || ' | ', '') || 'Encerrada automaticamente: lead reentrou no pipeline'
       WHERE pipeline_lead_id = NEW.id AND status = 'ativa' AND created_at < now();
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        INSERT INTO pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, observacao)
        VALUES (NEW.id, NEW.stage_id, NEW.stage_id, 'Parceria encerrada: lead reentrou no pipeline');
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.encerrar_parcerias_troca_corretor()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
    UPDATE public.pipeline_parcerias
       SET status = 'encerrada', encerrada_em = now(), updated_at = now(),
           motivo = COALESCE(motivo || ' | ', '') || 'Encerrada automaticamente: lead mudou de corretor'
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa' AND created_at < now();
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, observacao)
      VALUES (NEW.id, NEW.stage_id, NEW.stage_id, 'Parceria encerrada: lead mudou de corretor');
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $function$;