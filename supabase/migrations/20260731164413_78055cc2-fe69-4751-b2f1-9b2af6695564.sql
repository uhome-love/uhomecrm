-- 1) Entrada na etapa Visita: cria apenas UM card
CREATE OR REPLACE FUNCTION public.trg_visita_stage_entry_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_tipo text;
  v_new_tipo text;
  v_lead_nome text;
  v_now timestamptz := now();
  v_visita RECORD;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;

  SELECT tipo INTO v_old_tipo FROM public.pipeline_stages WHERE id = OLD.stage_id;
  SELECT tipo INTO v_new_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;

  IF v_old_tipo = 'visita' AND v_new_tipo IS DISTINCT FROM 'visita' AND v_new_tipo IS DISTINCT FROM 'pos_visita' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.id AND origem='visita_auto' AND status='pendente';
  END IF;

  v_lead_nome := COALESCE(NEW.nome, 'lead');

  IF v_new_tipo = 'visita' AND v_old_tipo IS DISTINCT FROM 'visita' THEN
    SELECT * INTO v_visita
      FROM public.visitas
     WHERE pipeline_lead_id = NEW.id
       AND status IN ('marcada','confirmada','reagendada')
     ORDER BY data_visita ASC, hora_visita ASC
     LIMIT 1;

    IF v_visita.id IS NOT NULL THEN
      -- Um card por vez: se a visita ainda vai acontecer → Confirmar visita.
      -- Se já passou (ou é hoje/confirmada) → Registrar resultado.
      IF v_visita.data_visita > CURRENT_DATE AND v_visita.status <> 'confirmada' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.pipeline_tarefas
           WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
             AND subtipo='confirmar_visita' AND status='pendente'
        ) THEN
          INSERT INTO public.pipeline_tarefas
            (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
             vence_em, hora_vencimento, origem, created_by)
          VALUES (NEW.id, 'follow_up', 'confirmar_visita',
            'Confirmar visita — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
            (v_visita.data_visita - INTERVAL '1 day')::date, '10:00'::time,
            'visita_auto', NEW.corretor_id);
        END IF;
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM public.pipeline_tarefas
           WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
             AND subtipo='registrar_resultado' AND status='pendente'
        ) THEN
          INSERT INTO public.pipeline_tarefas
            (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
             vence_em, hora_vencimento, origem, created_by)
          VALUES (NEW.id, 'follow_up', 'registrar_resultado',
            'Registrar resultado da visita — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
            GREATEST(v_visita.data_visita, (v_now AT TIME ZONE 'America/Sao_Paulo')::date),
            '18:00'::time, 'visita_auto', NEW.corretor_id);
        END IF;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_tarefas
         WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
           AND subtipo='atualizar_visita' AND status='pendente'
      ) THEN
        INSERT INTO public.pipeline_tarefas
          (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
           vence_em, hora_vencimento, origem, created_by)
        VALUES (NEW.id, 'follow_up', 'atualizar_visita',
          'Atualizar visita — ' || v_lead_nome, 'media', 'pendente', NEW.corretor_id,
          ((v_now + INTERVAL '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
          'visita_auto', NEW.corretor_id);
      END IF;
    END IF;
  END IF;

  IF v_new_tipo = 'pos_visita' AND v_old_tipo IS DISTINCT FROM 'pos_visita' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pipeline_tarefas
       WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
         AND subtipo='pegar_feedback' AND status='pendente'
    ) THEN
      INSERT INTO public.pipeline_tarefas
        (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
         vence_em, hora_vencimento, origem, created_by)
      VALUES (NEW.id, 'follow_up', 'pegar_feedback',
        'Alinhar próximos passos (Pós-Visita) — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
        ((v_now + INTERVAL '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
        'visita_auto', NEW.corretor_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Visita confirmada → próximo card (registrar resultado)
CREATE OR REPLACE FUNCTION public.visita_auto_tarefas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_confirm_ts timestamptz;
  v_vence date;
  v_hora time;
  v_status_changed boolean := (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status);
  v_date_changed boolean := (TG_OP = 'INSERT') OR (OLD.data_visita IS DISTINCT FROM NEW.data_visita) OR (OLD.hora_visita IS DISTINCT FROM NEW.hora_visita);
  v_now timestamptz := now();
  v_ultimos_no_show int;
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
      ((v_now + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
      'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
    RETURN NEW;
  END IF;

  IF v_status_changed AND NEW.status = 'no_show' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';

    SELECT count(*) INTO v_ultimos_no_show FROM (
      SELECT status FROM public.visitas
       WHERE pipeline_lead_id = NEW.pipeline_lead_id
         AND status IN ('no_show','realizada','cancelada','marcada','reagendada','confirmada')
       ORDER BY COALESCE(data_visita, created_at::date) DESC, updated_at DESC
       LIMIT 2
    ) t WHERE status = 'no_show';

    IF v_ultimos_no_show >= 2 THEN
      INSERT INTO public.pipeline_tarefas
        (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
         vence_em, hora_vencimento, origem, origem_ref, created_by)
      VALUES (NEW.pipeline_lead_id, 'follow_up', 'decidir_descarte_visita',
        'Decidir descarte (2º no-show) — ' || v_nome, 'alta', 'pendente', NEW.corretor_id,
        ((v_now + interval '3 days') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
        'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
    ELSE
      INSERT INTO public.pipeline_tarefas
        (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
         vence_em, hora_vencimento, origem, origem_ref, created_by)
      VALUES (NEW.pipeline_lead_id, 'follow_up', 'reagendar_visita',
        'Reagendar visita — ' || v_nome, 'media', 'pendente', NEW.corretor_id,
        ((v_now + interval '7 days') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
        'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
    END IF;
    RETURN NEW;
  END IF;

  IF v_status_changed AND NEW.status = 'confirmada' THEN
    UPDATE public.pipeline_tarefas SET status='cancelada', updated_at=v_now
      WHERE pipeline_lead_id = NEW.pipeline_lead_id AND origem='visita_auto' AND status='pendente';
    INSERT INTO public.pipeline_tarefas
      (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
       vence_em, hora_vencimento, origem, origem_ref, created_by)
    VALUES (NEW.pipeline_lead_id, 'follow_up', 'registrar_resultado',
      'Registrar resultado da visita — ' || v_nome, 'alta', 'pendente', NEW.corretor_id,
      GREATEST(NEW.data_visita, (v_now AT TIME ZONE 'America/Sao_Paulo')::date), '18:00'::time,
      'visita_auto', NEW.id, COALESCE(NEW.created_by, NEW.corretor_id));
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

-- 3) Concluir "Confirmar visita" → cria "Registrar resultado"
CREATE OR REPLACE FUNCTION public.trg_tarefa_confirmar_visita_encadeia_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_visita RECORD;
  v_nome text;
BEGIN
  IF NEW.subtipo IS DISTINCT FROM 'confirmar_visita' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'concluida' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'concluida' THEN RETURN NEW; END IF;
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_visita
    FROM public.visitas
   WHERE pipeline_lead_id = NEW.pipeline_lead_id
     AND status IN ('marcada','confirmada','reagendada')
   ORDER BY data_visita ASC, hora_visita ASC
   LIMIT 1;

  IF v_visita.id IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.pipeline_tarefas
     WHERE pipeline_lead_id = NEW.pipeline_lead_id
       AND origem='visita_auto' AND subtipo='registrar_resultado' AND status='pendente'
  ) THEN RETURN NEW; END IF;

  SELECT nome INTO v_nome FROM public.pipeline_leads WHERE id = NEW.pipeline_lead_id;

  INSERT INTO public.pipeline_tarefas
    (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
     vence_em, hora_vencimento, origem, origem_ref, created_by)
  VALUES (NEW.pipeline_lead_id, 'follow_up', 'registrar_resultado',
    'Registrar resultado da visita — ' || COALESCE(v_nome, 'lead'), 'alta', 'pendente',
    NEW.responsavel_id,
    GREATEST(v_visita.data_visita, (now() AT TIME ZONE 'America/Sao_Paulo')::date),
    '18:00'::time, 'visita_auto', v_visita.id, NEW.responsavel_id);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tarefa_confirmar_visita_encadeia ON public.pipeline_tarefas;
CREATE TRIGGER trg_tarefa_confirmar_visita_encadeia
AFTER UPDATE ON public.pipeline_tarefas
FOR EACH ROW EXECUTE FUNCTION public.trg_tarefa_confirmar_visita_encadeia_fn();

-- 4) Visita apagada/cancelada → reverte etapa e limpa flag
CREATE OR REPLACE FUNCTION public.trg_visita_removida_reverte_stage_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id uuid;
  v_stage_tipo text;
  v_has_realizada boolean;
  v_has_agendada boolean;
  v_destino uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_lead_id := OLD.pipeline_lead_id;
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'cancelada' THEN
      RETURN NEW;
    END IF;
    v_lead_id := NEW.pipeline_lead_id;
  END IF;

  IF v_lead_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT ps.tipo INTO v_stage_tipo
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
   WHERE pl.id = v_lead_id;

  SELECT EXISTS (
    SELECT 1 FROM public.visitas
     WHERE pipeline_lead_id = v_lead_id AND status = 'realizada'
       AND (TG_OP <> 'DELETE' OR id <> OLD.id)
  ) INTO v_has_realizada;

  SELECT EXISTS (
    SELECT 1 FROM public.visitas
     WHERE pipeline_lead_id = v_lead_id AND status IN ('marcada','reagendada','confirmada')
       AND (TG_OP <> 'DELETE' OR id <> OLD.id)
  ) INTO v_has_agendada;

  IF v_stage_tipo IN ('pos_visita','visita') AND NOT v_has_realizada THEN
    IF v_has_agendada THEN
      IF v_stage_tipo = 'pos_visita' THEN
        SELECT id INTO v_destino FROM public.pipeline_stages
         WHERE pipeline_tipo='leads' AND tipo='visita' LIMIT 1;
      END IF;
    ELSE
      SELECT id INTO v_destino FROM public.pipeline_stages
       WHERE pipeline_tipo='leads' AND tipo='qualificacao_busca' LIMIT 1;
      IF v_destino IS NULL THEN
        SELECT id INTO v_destino FROM public.pipeline_stages
         WHERE pipeline_tipo='leads' AND tipo='qualificacao' LIMIT 1;
      END IF;
    END IF;

    UPDATE public.pipeline_leads
       SET stage_id = COALESCE(v_destino, stage_id),
           stage_changed_at = CASE WHEN v_destino IS NOT NULL THEN now() ELSE stage_changed_at END,
           flag_status = (COALESCE(flag_status, '{}'::jsonb) - 'status_visita' - 'visita_id' - 'visita_data' - 'visita_hora'),
           updated_at = now()
     WHERE id = v_lead_id;

    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=now()
     WHERE pipeline_lead_id = v_lead_id AND origem='visita_auto' AND status='pendente';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_removida_reverte_stage ON public.visitas;
CREATE TRIGGER trg_visita_removida_reverte_stage
AFTER DELETE OR UPDATE OF status ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_visita_removida_reverte_stage_fn();