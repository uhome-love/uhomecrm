CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_acao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c lead_cadencia_sem_contato%ROWTYPE;
  v_next int; v_wait_next int; v_new_status text;
BEGIN
  IF NEW.tipo IS NULL OR NEW.tipo NOT IN (
      'ligacao','whatsapp','contato','nota','mensagem','email',
      'retorno','nao_atendeu','followup','reuniao','visita','envio_material'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM lead_cadencia_sem_contato
   WHERE pipeline_lead_id = NEW.pipeline_lead_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND OR c.tentativa_atual >= 7 THEN RETURN NEW; END IF;

  v_next := c.tentativa_atual + 1;
  IF v_next < 7 THEN
    SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
    v_new_status := 'ativa';
  ELSE
    v_wait_next := NULL; v_new_status := 'concluida';
  END IF;

  UPDATE lead_cadencia_sem_contato
     SET tentativa_atual = v_next, ultima_acao_em = now(),
         proxima_em = CASE WHEN v_wait_next IS NULL THEN NULL ELSE now() + (v_wait_next || ' minutes')::interval END,
         status = v_new_status,
         tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'pulada_por_acao', true, 'tipo', NEW.tipo, 'em', now()),
         updated_at = now()
   WHERE id = c.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c lead_cadencia_sem_contato%ROWTYPE;
  v_next int; v_wait_next int; v_new_status text;
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO c FROM lead_cadencia_sem_contato
   WHERE pipeline_lead_id = NEW.pipeline_lead_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND OR c.tentativa_atual >= 7 THEN RETURN NEW; END IF;

  v_next := c.tentativa_atual + 1;
  IF v_next < 7 THEN
    SELECT espera_minutos INTO v_wait_next FROM cadencia_sem_contato_passos WHERE numero = v_next + 1;
    v_new_status := 'ativa';
  ELSE
    v_wait_next := NULL; v_new_status := 'concluida';
  END IF;

  UPDATE lead_cadencia_sem_contato
     SET tentativa_atual = v_next, ultima_acao_em = now(),
         proxima_em = CASE WHEN v_wait_next IS NULL THEN NULL ELSE now() + (v_wait_next || ' minutes')::interval END,
         status = v_new_status,
         tentativas_log = tentativas_log || jsonb_build_object('n', v_next, 'pulada_por_acao', true, 'tipo', 'tarefa_criada', 'em', now()),
         updated_at = now()
   WHERE id = c.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cadencia_sc_avancar_tarefa ON public.pipeline_tarefas;
CREATE TRIGGER trg_cadencia_sc_avancar_tarefa
  AFTER INSERT ON public.pipeline_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.fn_cadencia_sc_avancar_tarefa();