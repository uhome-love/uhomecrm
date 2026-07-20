
-- (idempotente — tudo que já rodou fora do bloco da view será re-aplicado com segurança)

ALTER TABLE public.pipeline_tarefas
  ADD COLUMN IF NOT EXISTS retries_count int NOT NULL DEFAULT 0;

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

CREATE OR REPLACE FUNCTION public.trg_visita_stage_entry_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_tipo text;
  v_new_tipo text;
  v_has_visita boolean;
  v_lead_nome text;
  v_now timestamptz := now();
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_old_tipo FROM public.pipeline_stages WHERE id = OLD.stage_id;
  SELECT tipo INTO v_new_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;

  IF v_old_tipo = 'visita' AND (v_new_tipo IS NULL OR v_new_tipo <> 'visita') THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.id
       AND origem='visita_auto'
       AND status='pendente';
  END IF;

  IF v_new_tipo = 'visita' AND v_old_tipo IS DISTINCT FROM 'visita' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.visitas
       WHERE pipeline_lead_id = NEW.id
         AND status IN ('marcada','confirmada','reagendada','realizada')
    ) INTO v_has_visita;

    IF NOT v_has_visita THEN
      v_lead_nome := COALESCE(NEW.nome, 'lead');
      IF NOT EXISTS (
        SELECT 1 FROM public.pipeline_tarefas
         WHERE pipeline_lead_id = NEW.id
           AND origem = 'visita_auto'
           AND subtipo = 'atualizar_visita'
           AND status = 'pendente'
      ) THEN
        INSERT INTO public.pipeline_tarefas
          (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
           vence_em, hora_vencimento, origem, created_by)
        VALUES (NEW.id, 'follow_up', 'atualizar_visita',
          'Atualizar visita — ' || v_lead_nome, 'media', 'pendente', NEW.corretor_id,
          ((v_now + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
          'visita_auto', NEW.corretor_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_stage_entry ON public.pipeline_leads;
CREATE TRIGGER trg_visita_stage_entry
  AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_visita_stage_entry_fn();

DROP TRIGGER IF EXISTS trg_visita_status_to_pipeline ON public.visitas;
DROP TRIGGER IF EXISTS visita_status_to_pipeline_trigger ON public.visitas;

CREATE TABLE IF NOT EXISTS public.visita_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.visitas(id) ON DELETE CASCADE,
  pipeline_lead_id uuid REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  status_anterior text,
  status_novo text,
  data_anterior timestamptz,
  data_nova timestamptz,
  ator_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.visita_eventos TO authenticated;
GRANT ALL ON public.visita_eventos TO service_role;

ALTER TABLE public.visita_eventos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visita_eventos' AND policyname='visita_eventos_select_authenticated') THEN
    CREATE POLICY "visita_eventos_select_authenticated"
      ON public.visita_eventos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='visita_eventos' AND policyname='visita_eventos_insert_authenticated') THEN
    CREATE POLICY "visita_eventos_insert_authenticated"
      ON public.visita_eventos FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visita_eventos_lead ON public.visita_eventos(pipeline_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visita_eventos_visita ON public.visita_eventos(visita_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_visita_eventos_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_nova timestamptz;
  v_data_ant  timestamptz;
BEGIN
  v_data_nova := CASE WHEN NEW.data_visita IS NOT NULL
                      THEN (NEW.data_visita + COALESCE(NEW.hora_visita, time '10:00'))
                             AT TIME ZONE 'America/Sao_Paulo'
                      ELSE NULL END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.visita_eventos (visita_id, pipeline_lead_id, tipo, status_novo, data_nova, ator_id)
    VALUES (NEW.id, NEW.pipeline_lead_id, 'criada', NEW.status, v_data_nova, COALESCE(NEW.created_by, NEW.corretor_id));
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.visita_eventos (visita_id, pipeline_lead_id, tipo, status_anterior, status_novo, ator_id)
    VALUES (NEW.id, NEW.pipeline_lead_id, 'status_alterado', OLD.status, NEW.status, COALESCE(NEW.created_by, NEW.corretor_id));
  END IF;

  IF OLD.resultado_visita IS DISTINCT FROM NEW.resultado_visita AND NEW.resultado_visita IS NOT NULL THEN
    INSERT INTO public.visita_eventos (visita_id, pipeline_lead_id, tipo, status_novo, ator_id, observacao)
    VALUES (NEW.id, NEW.pipeline_lead_id, 'resultado_registrado', NEW.resultado_visita, COALESCE(NEW.created_by, NEW.corretor_id), NEW.resultado_visita);
  END IF;

  IF (OLD.data_visita IS DISTINCT FROM NEW.data_visita)
     OR (OLD.hora_visita IS DISTINCT FROM NEW.hora_visita) THEN
    v_data_ant := CASE WHEN OLD.data_visita IS NOT NULL
                       THEN (OLD.data_visita + COALESCE(OLD.hora_visita, time '10:00'))
                              AT TIME ZONE 'America/Sao_Paulo'
                       ELSE NULL END;
    INSERT INTO public.visita_eventos (visita_id, pipeline_lead_id, tipo, data_anterior, data_nova, ator_id)
    VALUES (NEW.id, NEW.pipeline_lead_id, 'data_alterada', v_data_ant, v_data_nova, COALESCE(NEW.created_by, NEW.corretor_id));
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visita_eventos ON public.visitas;
CREATE TRIGGER trg_visita_eventos
  AFTER INSERT OR UPDATE ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.trg_visita_eventos_fn();

DROP VIEW IF EXISTS public.v_lead_timeline;
CREATE VIEW public.v_lead_timeline
WITH (security_invoker = true)
AS
SELECT
  ph.pipeline_lead_id AS lead_id,
  ph.created_at,
  'etapa'::text AS categoria,
  'stage_move'::text AS tipo,
  ph.movido_por AS ator_id,
  ph.observacao AS descricao,
  ph.stage_novo_id::text AS ref_id,
  ph.id::text AS event_id
FROM public.pipeline_historico ph

UNION ALL
SELECT
  t.pipeline_lead_id,
  t.created_at,
  'tarefa'::text,
  ('tarefa_criada:' || COALESCE(t.subtipo, t.tipo))::text,
  t.created_by,
  t.titulo,
  t.id::text,
  ('task_new_' || t.id::text)
FROM public.pipeline_tarefas t
WHERE t.pipeline_lead_id IS NOT NULL

UNION ALL
SELECT
  t.pipeline_lead_id,
  COALESCE(t.concluida_em, t.updated_at),
  'tarefa'::text,
  ('tarefa_' || t.status || ':' || COALESCE(t.subtipo, t.tipo))::text,
  t.responsavel_id,
  t.titulo,
  t.id::text,
  ('task_end_' || t.id::text)
FROM public.pipeline_tarefas t
WHERE t.pipeline_lead_id IS NOT NULL
  AND t.status IN ('concluida','cancelada')

UNION ALL
SELECT
  ve.pipeline_lead_id,
  ve.created_at,
  'visita'::text,
  ('visita_' || ve.tipo)::text,
  ve.ator_id,
  COALESCE(ve.observacao,
    CASE
      WHEN ve.tipo = 'status_alterado' THEN ve.status_anterior || ' → ' || ve.status_novo
      WHEN ve.tipo = 'data_alterada' THEN 'Data alterada'
      ELSE ve.status_novo
    END),
  ve.visita_id::text,
  ve.id::text
FROM public.visita_eventos ve
WHERE ve.pipeline_lead_id IS NOT NULL

UNION ALL
SELECT
  a.pipeline_lead_id,
  a.created_at,
  'nota'::text,
  'nota'::text,
  a.autor_id,
  a.conteudo,
  a.id::text,
  a.id::text
FROM public.pipeline_anotacoes a;

GRANT SELECT ON public.v_lead_timeline TO authenticated;
