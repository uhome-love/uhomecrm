-- ============================================================
-- Fase A: nova etapa Pós-Visita (entre Visita e Em Negociação)
-- ============================================================

-- 1) Reordenar etapas existentes (Em Negociação 5→6, Contrato 6→7, Ganho 7→8)
--    Caiu(11) e Descarte(12) ficam intocados. Ordem só sobe para 5,6,7.
UPDATE public.pipeline_stages
   SET ordem = ordem + 1
 WHERE pipeline_tipo = 'leads'
   AND ordem BETWEEN 5 AND 7
   AND tipo <> 'pos_visita';

-- 2) Inserir Pós-Visita (idempotente)
INSERT INTO public.pipeline_stages (nome, tipo, ordem, cor, ativo, pipeline_tipo)
SELECT 'Pós-Visita', 'pos_visita', 5, '#06b6d4', true, 'leads'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.pipeline_stages
    WHERE pipeline_tipo='leads' AND tipo='pos_visita'
 );

-- ============================================================
-- 3) trg_clear_negocio_on_stage_regress — cutoff sobe de 5 para 6
--    (Em Negociação agora ordem 6). Regredir para Pós-Visita, Visita,
--    Aquecimento ou Qualificação arquiva o negócio.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_clear_negocio_on_stage_regress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_ordem INT;
  new_tipo TEXT;
  old_ordem INT;
BEGIN
  SELECT ordem, tipo INTO new_ordem, new_tipo
  FROM public.pipeline_stages WHERE id = NEW.stage_id;

  SELECT ordem INTO old_ordem
  FROM public.pipeline_stages WHERE id = OLD.stage_id;

  IF new_ordem IS NULL OR new_ordem >= 6 THEN RETURN NEW; END IF;
  IF new_tipo IN ('descarte','venda','caiu') THEN RETURN NEW; END IF;
  IF old_ordem IS NULL OR old_ordem < 6 THEN RETURN NEW; END IF;

  NEW.flag_status := COALESCE(NEW.flag_status,'{}'::jsonb) - 'status_negociacao' - 'status_contrato';

  IF NEW.negocio_id IS NOT NULL THEN
    UPDATE public.negocios
       SET status='arquivado', updated_at=now()
     WHERE id = NEW.negocio_id AND status='ativo';
    NEW.negocio_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 4) trg_pdn_mirror_pipeline_lead — mapeia pos_visita → pos_visita
--    (remove mapping antigo de 'visita' → 'visita_realizada').
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_pdn_mirror_pipeline_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_stage_tipo text;
  motivo_txt text;
  new_situacao text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.arquivado IS DISTINCT FROM OLD.arquivado THEN
    SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;

    IF NEW.arquivado = true OR new_stage_tipo IN ('descarte','caiu') THEN
      motivo_txt := COALESCE(
        NULLIF(NEW.motivo_descarte, ''),
        CASE
          WHEN NEW.arquivado = true THEN 'Lead inativado pelo corretor'
          WHEN new_stage_tipo = 'descarte' THEN 'Descartado no pipeline pelo corretor'
          WHEN new_stage_tipo = 'caiu' THEN 'Caiu no pipeline'
          ELSE 'Encerrado pelo corretor'
        END
      );
      UPDATE public.pdn_entries
         SET caiu = true,
             motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
             updated_at = now()
       WHERE pipeline_lead_id = NEW.id
         AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
      IF NEW.negocio_id IS NOT NULL THEN
        UPDATE public.pdn_entries
           SET caiu = true,
               motivo_queda = COALESCE(NULLIF(motivo_queda,''), motivo_txt),
               updated_at = now()
         WHERE negocio_id = NEW.negocio_id
           AND (caiu IS DISTINCT FROM true OR COALESCE(motivo_queda,'') = '');
      END IF;
    ELSE
      new_situacao := CASE new_stage_tipo
        WHEN 'proposta' THEN 'em_negociacao'
        WHEN 'contrato_gerado' THEN 'contrato'
        WHEN 'venda' THEN 'ganho'
        WHEN 'pos_visita' THEN 'pos_visita'
        ELSE NULL
      END;
      IF new_situacao IS NOT NULL THEN
        UPDATE public.pdn_entries
           SET situacao = new_situacao,
               grupo_override = NULL,
               caiu = false,
               motivo_queda = NULL,
               updated_at = now()
         WHERE pipeline_lead_id = NEW.id
           AND (situacao IS DISTINCT FROM new_situacao OR caiu = true OR grupo_override IS NOT NULL);
        IF NEW.negocio_id IS NOT NULL THEN
          UPDATE public.pdn_entries
             SET situacao = new_situacao,
                 grupo_override = NULL,
                 caiu = false,
                 motivo_queda = NULL,
                 updated_at = now()
           WHERE negocio_id = NEW.negocio_id
             AND (situacao IS DISTINCT FROM new_situacao OR caiu = true OR grupo_override IS NOT NULL);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 5) notify_visita_realizada_gerente — agora dispara em pos_visita
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_visita_realizada_gerente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_tipo text;
  v_old_stage_tipo text;
  v_gerente_ids uuid[];
  v_corretor_nome text;
  v_gid uuid;
BEGIN
  IF OLD.stage_id = NEW.stage_id THEN RETURN NEW; END IF;

  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT tipo INTO v_old_stage_tipo FROM pipeline_stages WHERE id = OLD.stage_id;

  IF v_stage_tipo = 'pos_visita' AND v_old_stage_tipo IS DISTINCT FROM 'pos_visita' THEN
    SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;

    SELECT array_agg(DISTINCT g_id) INTO v_gerente_ids
    FROM (
      SELECT tm.gerente_id AS g_id
      FROM team_members tm
      WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo' AND tm.gerente_id IS NOT NULL
      UNION
      SELECT ur.user_id AS g_id
      FROM user_roles ur WHERE ur.role = 'admin'
    ) sub;

    IF v_gerente_ids IS NOT NULL THEN
      FOREACH v_gid IN ARRAY v_gerente_ids LOOP
        PERFORM criar_notificacao(
          v_gid, 'pipeline', 'visita_realizada',
          '🏠 Pós-Visita — Alinhe próximos passos',
          COALESCE(v_corretor_nome, 'Corretor') || ' concluiu visita com ' || COALESCE(NEW.nome, 'cliente') || CASE WHEN NEW.valor_estimado IS NOT NULL AND NEW.valor_estimado > 0 THEN ' (valor alto: R$ ' || to_char(NEW.valor_estimado, 'FM999G999G999') || ')' ELSE '' END || '. Alinhe se evolui para Em Negociação ou regride.',
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor', v_corretor_nome, 'empreendimento', NEW.empreendimento, 'valor', NEW.valor_estimado),
          NULL
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 6) trg_visita_stage_entry_fn — ao entrar em pos_visita, criar
--    tarefa pegar_feedback (48h) se não houver.
-- ============================================================
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

  -- Ao sair de Visita para algo que não seja Visita nem Pós-Visita, cancela tarefas visita_auto.
  -- Manter tarefas ao ir para pos_visita para o corretor continuar acompanhando; a de
  -- pegar_feedback será garantida abaixo.
  IF v_old_tipo = 'visita' AND v_new_tipo IS DISTINCT FROM 'visita' AND v_new_tipo IS DISTINCT FROM 'pos_visita' THEN
    UPDATE public.pipeline_tarefas
       SET status='cancelada', updated_at=v_now
     WHERE pipeline_lead_id = NEW.id
       AND origem='visita_auto'
       AND status='pendente';
  END IF;

  -- Entrando em Visita sem visita agendada: criar "atualizar_visita" (fluxo original).
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

  -- Entrando em Pós-Visita: garantir tarefa pegar_feedback (48h).
  IF v_new_tipo = 'pos_visita' AND v_old_tipo IS DISTINCT FROM 'pos_visita' THEN
    v_lead_nome := COALESCE(NEW.nome, 'lead');
    IF NOT EXISTS (
      SELECT 1 FROM public.pipeline_tarefas
       WHERE pipeline_lead_id = NEW.id
         AND origem = 'visita_auto'
         AND subtipo = 'pegar_feedback'
         AND status = 'pendente'
    ) THEN
      INSERT INTO public.pipeline_tarefas
        (pipeline_lead_id, tipo, subtipo, titulo, prioridade, status, responsavel_id,
         vence_em, hora_vencimento, origem, created_by)
      VALUES (NEW.id, 'follow_up', 'pegar_feedback',
        'Alinhar próximos passos (Pós-Visita) — ' || v_lead_nome, 'alta', 'pendente', NEW.corretor_id,
        ((v_now + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date, '10:00'::time,
        'visita_auto', NEW.corretor_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 7) fn_reconciliar_visita_auto — também cobre pos_visita (feedback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_reconciliar_visita_auto()
 RETURNS TABLE(subtipo text, criadas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_ids uuid[];
  r record;
  v_ultima_status text;
  v_ultima_data date;
  v_subtipo text;
  v_tipo text;
  v_titulo text;
  v_vence date;
  v_counts jsonb := '{}'::jsonb;
  k text;
  v_stage_tipo text;
BEGIN
  SELECT array_agg(id) INTO v_stage_ids
    FROM public.pipeline_stages
   WHERE tipo IN ('visita','pos_visita');
  IF v_stage_ids IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT l.id, l.nome, l.corretor_id, l.created_by, ps.tipo AS stage_tipo
      FROM public.pipeline_leads l
      JOIN public.pipeline_stages ps ON ps.id = l.stage_id
     WHERE l.stage_id = ANY(v_stage_ids)
       AND COALESCE(l.arquivado, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM public.pipeline_tarefas t
          WHERE t.pipeline_lead_id = l.id
            AND t.origem = 'visita_auto'
            AND t.status = 'pendente'
       )
  LOOP
    v_stage_tipo := r.stage_tipo;
    SELECT v.status, v.data_visita
      INTO v_ultima_status, v_ultima_data
      FROM public.visitas v
     WHERE v.pipeline_lead_id = r.id
     ORDER BY v.data_visita DESC NULLS LAST, v.created_at DESC
     LIMIT 1;

    v_subtipo := NULL;

    IF v_stage_tipo = 'pos_visita' THEN
      v_subtipo := 'pegar_feedback';
      v_tipo := 'follow_up';
      v_titulo := 'Alinhar próximos passos (Pós-Visita) — ' || COALESCE(r.nome, 'lead');
      v_vence := ((now() + interval '48 hours') AT TIME ZONE 'America/Sao_Paulo')::date;
    ELSIF v_ultima_status IS NULL OR v_ultima_status = 'cancelada' THEN
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
    VALUES (r.id, v_tipo, v_subtipo, v_titulo,
      CASE WHEN v_stage_tipo='pos_visita' THEN 'alta' ELSE 'media' END,
      'pendente', r.corretor_id,
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

-- ============================================================
-- 8) Normalizar PDN legacy: entradas com situacao='visita_realizada'
--    ou 'visita' passam a 'pos_visita'.
-- ============================================================
UPDATE public.pdn_entries
   SET situacao = 'pos_visita', updated_at = now()
 WHERE situacao IN ('visita_realizada','visita');
