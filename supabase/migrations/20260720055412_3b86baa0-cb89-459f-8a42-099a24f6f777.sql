
-- 1) Nova coluna de rastreio
ALTER TABLE public.pipeline_tarefas
  ADD COLUMN IF NOT EXISTS origem_ref uuid;

CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_origem_ref
  ON public.pipeline_tarefas(origem, origem_ref)
  WHERE origem_ref IS NOT NULL;

-- 2) Isenta 'visita_auto' do cap de 30/90d
CREATE OR REPLACE FUNCTION public._pipeline_tarefas_cap_30d()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_tipo text;
  v_due_ts timestamptz;
BEGIN
  IF NEW.vence_em IS NULL OR NEW.concluida_em IS NOT NULL OR COALESCE(NEW.status,'') = 'concluida' THEN
    RETURN NEW;
  END IF;

  -- Automações do sistema são isentas do teto.
  IF NEW.origem IN ('cadencia_sem_contato','visita_auto') THEN
    RETURN NEW;
  END IF;

  SELECT ps.tipo INTO v_stage_tipo
  FROM public.pipeline_leads pl
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE pl.id = NEW.pipeline_lead_id;

  IF v_stage_tipo = 'sem_contato' THEN
    v_due_ts := (NEW.vence_em + COALESCE(NEW.hora_vencimento, time '23:59')) AT TIME ZONE 'America/Sao_Paulo';
    IF v_due_ts > now() + interval '48 hours' THEN
      RAISE EXCEPTION 'Em Sem Contato, tarefas só podem ser agendadas para no máximo 48 horas à frente. Essa etapa tem ritmo diário.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_stage_tipo = 'aquecimento' THEN
    IF NEW.vence_em > CURRENT_DATE + 90 THEN
      RAISE EXCEPTION 'No Aquecimento, tarefas podem ser agendadas para no máximo 90 dias à frente.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.vence_em > CURRENT_DATE + 30 THEN
      RAISE EXCEPTION 'Tarefas podem ser agendadas para no máximo 30 dias à frente.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Função da automação
CREATE OR REPLACE FUNCTION public.visita_auto_tarefas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_nome text;
  v_confirm_ts timestamptz;   -- momento alvo da tarefa "Confirmar" (D-24h)
  v_vence date;
  v_hora time;
  v_status_changed boolean := (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status);
  v_date_changed boolean := (TG_OP = 'INSERT') OR (OLD.data_visita IS DISTINCT FROM NEW.data_visita) OR (OLD.hora_visita IS DISTINCT FROM NEW.hora_visita);
  v_now timestamptz := now();
BEGIN
  -- Sem lead vinculado, ignora.
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_nome := COALESCE(NEW.nome_cliente, 'lead');

  -- Helper: cancelar todas pendentes desta visita
  --   (via subquery abaixo em cada bloco)

  -- BLOCO D: CANCELADA -> só cancela pendentes, não cria nada
  IF v_status_changed AND NEW.status = 'cancelada' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem = 'visita_auto'
       AND status = 'pendente';
    RETURN NEW;
  END IF;

  -- BLOCO C: REALIZADA -> "Pegar feedback" em 24h
  IF v_status_changed AND NEW.status = 'realizada' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem = 'visita_auto'
       AND status = 'pendente';

    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (
      NEW.pipeline_lead_id, 'follow_up',
      'Pegar feedback da visita — ' || v_nome,
      'media', 'pendente', NEW.corretor_id,
      ((v_now + interval '24 hours') AT TIME ZONE 'America/Sao_Paulo')::date,
      '10:00'::time,
      'visita_auto', NEW.id,
      COALESCE(NEW.created_by, NEW.corretor_id)
    );
    RETURN NEW;
  END IF;

  -- BLOCO B: NO-SHOW -> "Reagendar visita" em 48h
  IF v_status_changed AND NEW.status = 'no_show' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem = 'visita_auto'
       AND status = 'pendente';

    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (
      NEW.pipeline_lead_id, 'follow_up',
      'Reagendar visita — ' || v_nome,
      'media', 'pendente', NEW.corretor_id,
      ((v_now + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date,
      '10:00'::time,
      'visita_auto', NEW.id,
      COALESCE(NEW.created_by, NEW.corretor_id)
    );
    RETURN NEW;
  END IF;

  -- BLOCO 'confirmada' -> cancela pendente "Confirmar", não cria (objetivo cumprido)
  IF v_status_changed AND NEW.status = 'confirmada' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem = 'visita_auto'
       AND status = 'pendente';
    RETURN NEW;
  END IF;

  -- BLOCO A: CONFIRMAR VISITA (24h antes) para status marcada/reagendada
  IF NEW.status IN ('marcada','reagendada')
     AND NEW.data_visita IS NOT NULL
     AND (v_status_changed OR v_date_changed)
  THEN
    v_hora := COALESCE(NEW.hora_visita, time '10:00');
    v_confirm_ts := ((NEW.data_visita + v_hora) AT TIME ZONE 'America/Sao_Paulo') - interval '24 hours';

    -- Não nasce atrasada: se D-24h já passou, agenda pra hoje BRT.
    IF v_confirm_ts < v_now THEN
      v_vence := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSE
      v_vence := (v_confirm_ts AT TIME ZONE 'America/Sao_Paulo')::date;
    END IF;

    -- Cancela pendentes anteriores desta visita
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem = 'visita_auto'
       AND status = 'pendente';

    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (
      NEW.pipeline_lead_id, 'visita',
      'Confirmar visita — ' || v_nome,
      'alta', 'pendente', NEW.corretor_id,
      v_vence, v_hora,
      'visita_auto', NEW.id,
      COALESCE(NEW.created_by, NEW.corretor_id)
    );
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_visita_auto_tarefas ON public.visitas;
CREATE TRIGGER trg_visita_auto_tarefas
AFTER INSERT OR UPDATE OF status, data_visita, hora_visita ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.visita_auto_tarefas();

-- 4) Backfill: visitas futuras marcadas sem tarefa "Confirmar" pendente
INSERT INTO public.pipeline_tarefas
  (pipeline_lead_id, tipo, titulo, prioridade, status, responsavel_id,
   vence_em, hora_vencimento, origem, origem_ref, created_by)
SELECT
  v.pipeline_lead_id, 'visita',
  'Confirmar visita — ' || COALESCE(v.nome_cliente,'lead'),
  'alta', 'pendente', v.corretor_id,
  GREATEST(
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    ((( v.data_visita + COALESCE(v.hora_visita, time '10:00') ) AT TIME ZONE 'America/Sao_Paulo') - interval '24 hours')::date
  ),
  COALESCE(v.hora_visita, time '10:00'),
  'visita_auto', v.id,
  COALESCE(v.created_by, v.corretor_id)
FROM public.visitas v
WHERE v.pipeline_lead_id IS NOT NULL
  AND v.status IN ('marcada','reagendada')
  AND v.data_visita >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_tarefas t
     WHERE t.pipeline_lead_id = v.pipeline_lead_id
       AND t.origem = 'visita_auto'
       AND t.origem_ref = v.id
       AND t.status = 'pendente'
  );
