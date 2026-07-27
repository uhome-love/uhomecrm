-- ==========================================================================
-- Fase A — Auditoria e correção do fluxo Visita → Pós-Visita (v2)
-- ==========================================================================

-- ---- A0. Fix pré-existente: notify_visita_criada não trata gerente_id NULL ----
CREATE OR REPLACE FUNCTION public.notify_visita_criada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_nome text;
BEGIN
  SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;

  IF NEW.gerente_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      NEW.gerente_id, 'visitas', 'visita_marcada', 'Nova visita marcada',
      COALESCE(v_corretor_nome, 'Corretor') || ' marcou visita com ' || COALESCE(NEW.nome_cliente, 'cliente') || ' em ' || COALESCE(NEW.empreendimento, 'N/A'),
      jsonb_build_object('visita_id', NEW.id, 'nome_cliente', NEW.nome_cliente, 'corretor_nome', v_corretor_nome, 'data', NEW.data_visita, 'empreendimento', NEW.empreendimento),
      'visita_marcada'
    );
  END IF;

  IF NEW.status = 'confirmada' AND NEW.corretor_id IS NOT NULL THEN
    PERFORM criar_notificacao(
      NEW.corretor_id, 'visitas', 'visita_confirmada', 'Visita confirmada!',
      'Visita com ' || COALESCE(NEW.nome_cliente, 'cliente') || ' confirmada para ' || NEW.data_visita,
      jsonb_build_object('visita_id', NEW.id, 'nome_cliente', NEW.nome_cliente, 'data', NEW.data_visita),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- ---- A1. Backfill dos leads órfãos em Pós-Visita ----
INSERT INTO public.visitas (
  pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone, empreendimento,
  data_visita, hora_visita, status, observacoes, origem, tipo, created_by
)
SELECT
  pl.id,
  pl.corretor_id,
  (SELECT tm.gerente_id FROM public.team_members tm WHERE tm.user_id = pl.corretor_id LIMIT 1),
  COALESCE(pl.nome, 'Lead'),
  pl.telefone,
  COALESCE(pl.empreendimento, 'Não informado'),
  COALESCE(pl.stage_changed_at::date, CURRENT_DATE),
  '10:00'::time,
  'realizada',
  'Backfill 27/07/2026: registro retroativo criado para consistência (lead estava em Pós-Visita via flag_status.status_visita=realizada, sem registro na agenda).',
  'backfill_pos_visita',
  'presencial',
  pl.corretor_id
FROM public.pipeline_leads pl
WHERE pl.stage_id = '72e0ffb4-396e-457d-8235-13f018408ff1'
  AND pl.arquivado = false
  AND NOT EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE v.pipeline_lead_id = pl.id AND v.status = 'realizada'
  );

UPDATE public.pipeline_leads
   SET flag_status = jsonb_set(COALESCE(flag_status, '{}'::jsonb), '{status_visita}', '"realizada"')
 WHERE stage_id = '72e0ffb4-396e-457d-8235-13f018408ff1'
   AND flag_status->>'status_visita' = 'pos_visita';

-- ---- A2. Trigger: visita.status='realizada' → move lead para pos_visita ----
CREATE OR REPLACE FUNCTION public.trg_visita_realizada_move_pos_visita_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pos_visita_id uuid := '72e0ffb4-396e-457d-8235-13f018408ff1';
  v_current_ordem int;
  v_pos_visita_ordem int := 5;
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'realizada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'realizada' THEN RETURN NEW; END IF;

  SELECT ps.ordem INTO v_current_ordem
    FROM public.pipeline_leads pl
    JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
   WHERE pl.id = NEW.pipeline_lead_id;

  IF v_current_ordem IS NOT NULL AND v_current_ordem < v_pos_visita_ordem THEN
    UPDATE public.pipeline_leads
       SET stage_id = v_pos_visita_id,
           stage_changed_at = now(),
           flag_status = jsonb_set(COALESCE(flag_status, '{}'::jsonb), '{status_visita}', '"realizada"'),
           updated_at = now()
     WHERE id = NEW.pipeline_lead_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_realizada_move_pos_visita ON public.visitas;
CREATE TRIGGER trg_visita_realizada_move_pos_visita
AFTER INSERT OR UPDATE OF status ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_visita_realizada_move_pos_visita_fn();

-- ---- A3. Trigger: garante visita realizada ao entrar em pos_visita ----
CREATE OR REPLACE FUNCTION public.trg_pos_visita_garante_visita_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pos_visita_id uuid := '72e0ffb4-396e-457d-8235-13f018408ff1';
  v_has_realizada boolean;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  IF NEW.stage_id <> v_pos_visita_id THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.visitas
    WHERE pipeline_lead_id = NEW.id AND status = 'realizada'
  ) INTO v_has_realizada;

  IF NOT v_has_realizada THEN
    INSERT INTO public.visitas (
      pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone, empreendimento,
      data_visita, hora_visita, status, observacoes, origem, tipo, created_by
    ) VALUES (
      NEW.id, NEW.corretor_id,
      (SELECT tm.gerente_id FROM public.team_members tm WHERE tm.user_id = NEW.corretor_id LIMIT 1),
      COALESCE(NEW.nome, 'Lead'), NEW.telefone,
      COALESCE(NEW.empreendimento, 'Não informado'),
      CURRENT_DATE, '10:00'::time, 'realizada',
      'Registro automático: lead movido para Pós-Visita sem visita agendada previamente.',
      'auto_stage_move', 'presencial', NEW.corretor_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pos_visita_garante_visita ON public.pipeline_leads;
CREATE TRIGGER trg_pos_visita_garante_visita
AFTER UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pos_visita_garante_visita_fn();

-- ---- A4. Reescrita trg_visita_stage_entry_fn ----
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
      IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_tarefas
         WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
           AND subtipo='confirmar_visita' AND status='pendente'
      ) AND v_visita.data_visita > CURRENT_DATE THEN
        INSERT INTO public.pipeline_tarefas
          (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
           vence_em, hora_vencimento, origem, created_by)
        VALUES (NEW.id, 'follow_up', 'confirmar_visita',
          'Confirmar visita — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
          (v_visita.data_visita - INTERVAL '1 day')::date, '10:00'::time,
          'visita_auto', NEW.corretor_id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_tarefas
         WHERE pipeline_lead_id=NEW.id AND origem='visita_auto'
           AND subtipo='realizar_visita' AND status='pendente'
      ) THEN
        INSERT INTO public.pipeline_tarefas
          (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
           vence_em, hora_vencimento, origem, created_by)
        VALUES (NEW.id, 'follow_up', 'realizar_visita',
          'Fazer visita — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
          v_visita.data_visita, COALESCE(v_visita.hora_visita, '10:00'::time),
          'visita_auto', NEW.corretor_id);
      END IF;

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
          (v_visita.data_visita + INTERVAL '1 day')::date, '10:00'::time,
          'visita_auto', NEW.corretor_id);
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

-- ---- A5. Trigger: sincroniza visitas.status → pipeline_leads.flag_status.status_visita ----
CREATE OR REPLACE FUNCTION public.trg_visita_sync_flag_status_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('marcada','confirmada','realizada','no_show','reagendada') THEN
    RETURN NEW;
  END IF;

  UPDATE public.pipeline_leads
     SET flag_status = jsonb_set(COALESCE(flag_status, '{}'::jsonb), '{status_visita}', to_jsonb(NEW.status)),
         updated_at = now()
   WHERE id = NEW.pipeline_lead_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_sync_flag_status ON public.visitas;
CREATE TRIGGER trg_visita_sync_flag_status
AFTER INSERT OR UPDATE OF status ON public.visitas
FOR EACH ROW EXECUTE FUNCTION public.trg_visita_sync_flag_status_fn();