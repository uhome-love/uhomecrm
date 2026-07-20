
-- ============================================================
-- Parte 1: coluna subtipo + índice
-- ============================================================
ALTER TABLE public.pipeline_tarefas ADD COLUMN IF NOT EXISTS subtipo text;
CREATE INDEX IF NOT EXISTS idx_pipeline_tarefas_subtipo
  ON public.pipeline_tarefas (subtipo) WHERE subtipo IS NOT NULL;

-- Backfill: mapear subtipo das visita_auto existentes pelo título
UPDATE public.pipeline_tarefas
   SET subtipo = CASE
     WHEN titulo ILIKE 'Confirmar visita%'   THEN 'confirmar_visita'
     WHEN titulo ILIKE 'Pegar feedback%'     THEN 'pegar_feedback'
     WHEN titulo ILIKE 'Reagendar visita%'   THEN 'reagendar_visita'
     WHEN titulo ILIKE 'Agendar visita%'     THEN 'agendar_visita'
     WHEN titulo ILIKE 'Registrar resultado%' THEN 'registrar_resultado'
     ELSE subtipo
   END
 WHERE origem = 'visita_auto' AND subtipo IS NULL;

-- ============================================================
-- Parte 2: recria visita_auto_tarefas gravando subtipo
-- ============================================================
CREATE OR REPLACE FUNCTION public.visita_auto_tarefas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_nome text;
  v_confirm_ts timestamptz;
  v_vence date;
  v_hora time;
  v_status_changed boolean := (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status);
  v_date_changed boolean := (TG_OP = 'INSERT') OR (OLD.data_visita IS DISTINCT FROM NEW.data_visita) OR (OLD.hora_visita IS DISTINCT FROM NEW.hora_visita);
  v_now timestamptz := now();
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;
  v_nome := COALESCE(NEW.nome_cliente, 'lead');

  IF v_status_changed AND NEW.status = 'cancelada' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';
    RETURN NEW;
  END IF;

  IF v_status_changed AND NEW.status = 'realizada' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';
    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (NEW.pipeline_lead_id, 'follow_up', 'pegar_feedback',
      'Pegar feedback da visita — ' || v_nome, 'media', 'pendente', NEW.corretor_id,
      ((v_now + interval '24 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
      'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
    RETURN NEW;
  END IF;

  IF v_status_changed AND NEW.status = 'no_show' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';
    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (NEW.pipeline_lead_id, 'follow_up', 'reagendar_visita',
      'Reagendar visita — ' || v_nome, 'media', 'pendente', NEW.corretor_id,
      ((v_now + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
      'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
    RETURN NEW;
  END IF;

  IF v_status_changed AND NEW.status = 'confirmada' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';
    RETURN NEW;
  END IF;

  IF NEW.status IN ('marcada','reagendada')
     AND NEW.data_visita IS NOT NULL
     AND (v_status_changed OR v_date_changed)
  THEN
    v_hora := COALESCE(NEW.hora_visita, time '10:00');
    v_confirm_ts := ((NEW.data_visita + v_hora) AT TIME ZONE 'America/Sao_Paulo') - interval '24 hours';
    IF v_confirm_ts < v_now THEN
      v_vence := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSE
      v_vence := (v_confirm_ts AT TIME ZONE 'America/Sao_Paulo')::date;
    END IF;

    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';

    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (NEW.pipeline_lead_id, 'follow_up', 'confirmar_visita',
      'Confirmar visita — ' || v_nome, 'media', 'pendente', NEW.corretor_id,
      v_vence, '10:00'::time, 'visita_auto', NEW.id,
      COALESCE(NEW.created_by, NEW.corretor_id));
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- Parte 3: regra de entrada (stage → visita)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_visita_stage_entry_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_new_tipo text;
  v_old_tipo text;
  v_has_visita_futura boolean;
  v_has_pending boolean;
  v_nome text;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id = OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_new_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
  SELECT tipo INTO v_old_tipo FROM public.pipeline_stages WHERE id = OLD.stage_id;

  IF v_new_tipo IS DISTINCT FROM 'visita' THEN RETURN NEW; END IF;
  IF v_old_tipo = 'visita' THEN RETURN NEW; END IF;

  -- tem visita futura acionável? não cria.
  SELECT EXISTS(
    SELECT 1 FROM public.visitas
     WHERE pipeline_lead_id = NEW.id
       AND status IN ('marcada','reagendada','confirmada')
       AND data_visita >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) INTO v_has_visita_futura;
  IF v_has_visita_futura THEN RETURN NEW; END IF;

  -- idempotência: já tem visita_auto pendente?
  SELECT EXISTS(
    SELECT 1 FROM public.pipeline_tarefas
     WHERE pipeline_lead_id = NEW.id AND origem='visita_auto' AND status='pendente'
  ) INTO v_has_pending;
  IF v_has_pending THEN RETURN NEW; END IF;

  v_nome := COALESCE(NEW.nome, 'lead');
  INSERT INTO public.pipeline_tarefas
    (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
     vence_em, hora_vencimento, origem, created_by)
  VALUES (NEW.id, 'marcar_visita', 'agendar_visita',
    'Agendar visita — ' || v_nome, 'media', 'pendente', NEW.corretor_id,
    ((now() + interval '24 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
    'visita_auto', COALESCE(NEW.corretor_id, NEW.created_by));

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_stage_entry_tarefa ON public.pipeline_leads;
CREATE TRIGGER trg_visita_stage_entry_tarefa
  AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_visita_stage_entry_tarefa();

-- ============================================================
-- Parte 4: função de reconciliação (backfill único)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_reconciliar_visita_auto()
RETURNS TABLE(subtipo text, criadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stage_id uuid;
  r record;
  v_ultima_status text;
  v_ultima_data date;
  v_subtipo text;
  v_tipo text;
  v_titulo text;
  v_vence date;
  v_counts jsonb := '{}'::jsonb;
  k text;
BEGIN
  SELECT id INTO v_stage_id FROM public.pipeline_stages WHERE tipo='visita' LIMIT 1;
  IF v_stage_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT l.id, l.nome, l.corretor_id, l.created_by
      FROM public.pipeline_leads l
     WHERE l.stage_id = v_stage_id
       AND COALESCE(l.arquivado, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM public.pipeline_tarefas t
          WHERE t.pipeline_lead_id = l.id
            AND t.origem = 'visita_auto'
            AND t.status = 'pendente'
       )
  LOOP
    SELECT v.status, v.data_visita
      INTO v_ultima_status, v_ultima_data
      FROM public.visitas v
     WHERE v.pipeline_lead_id = r.id
     ORDER BY v.data_visita DESC NULLS LAST, v.created_at DESC
     LIMIT 1;

    v_subtipo := NULL;

    IF v_ultima_status IS NULL OR v_ultima_status = 'cancelada' THEN
      v_subtipo := 'agendar_visita';
      v_tipo := 'marcar_visita';
      v_titulo := 'Agendar visita — ' || COALESCE(r.nome, 'lead');
      v_vence := ((now() + interval '24 hours') AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSIF v_ultima_status = 'no_show' THEN
      v_subtipo := 'reagendar_visita';
      v_tipo := 'marcar_visita';
      v_titulo := 'Reagendar visita — ' || COALESCE(r.nome, 'lead');
      v_vence := ((now() + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSIF v_ultima_status = 'realizada' THEN
      v_subtipo := 'pegar_feedback';
      v_tipo := 'follow_up';
      v_titulo := 'Pegar feedback da visita — ' || COALESCE(r.nome, 'lead');
      v_vence := ((now() + interval '24 hours') AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSIF v_ultima_status IN ('marcada','reagendada','confirmada') THEN
      IF v_ultima_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
        v_subtipo := 'registrar_resultado';
        v_tipo := 'follow_up';
        v_titulo := 'Registrar resultado da visita — ' || COALESCE(r.nome, 'lead');
        v_vence := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
      ELSE
        CONTINUE;
      END IF;
    ELSE
      CONTINUE;
    END IF;

    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, created_by)
    VALUES (r.id, v_tipo, v_subtipo, v_titulo, 'media', 'pendente', r.corretor_id,
      v_vence, '10:00'::time, 'visita_auto', COALESCE(r.corretor_id, r.created_by));

    v_counts := jsonb_set(v_counts, ARRAY[v_subtipo],
      to_jsonb(COALESCE((v_counts->>v_subtipo)::int, 0) + 1));
  END LOOP;

  FOR k IN SELECT jsonb_object_keys(v_counts) LOOP
    subtipo := k;
    criadas := (v_counts->>k)::int;
    RETURN NEXT;
  END LOOP;
END;
$function$;
