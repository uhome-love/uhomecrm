CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sem_contato uuid := '2fcba9be-1188-4a54-9452-394beefdc330';
  v_first_wait int;
  v_due timestamptz;
  v_vence date;
  v_hora time;
  v_passo public.cadencia_sem_contato_passos%ROWTYPE;
BEGIN
  IF NEW.stage_id = sem_contato
     AND NEW.corretor_id IS NOT NULL
     AND NEW.arquivado IS NOT TRUE
     AND (TG_OP = 'INSERT' OR OLD.stage_id IS DISTINCT FROM NEW.stage_id OR OLD.corretor_id IS DISTINCT FROM NEW.corretor_id)
  THEN
    SELECT * INTO v_passo FROM public.cadencia_sem_contato_passos WHERE numero = 1;
    v_first_wait := COALESCE(v_passo.espera_minutos, 0);
    v_due := now() + (v_first_wait || ' minutes')::interval;
    v_vence := (v_due AT TIME ZONE 'America/Sao_Paulo')::date;
    v_hora := (v_due AT TIME ZONE 'America/Sao_Paulo')::time(0);

    INSERT INTO public.lead_cadencia_sem_contato
      (pipeline_lead_id, corretor_id, iniciada_em, tentativa_atual, proxima_em, status, tentativas_log)
    VALUES
      (NEW.id, NEW.corretor_id, now(), 0, v_due, 'ativa', '[]'::jsonb)
    ON CONFLICT (pipeline_lead_id) DO UPDATE SET
      corretor_id = NEW.corretor_id,
      iniciada_em = now(),
      tentativa_atual = 0,
      proxima_em = v_due,
      status = 'ativa',
      tentativas_log = '[]'::jsonb,
      updated_at = now();

    -- Garante a tarefa operacional da T1. Tentativa só avança quando essa tarefa for concluída.
    IF NOT EXISTS (
      SELECT 1
      FROM public.pipeline_tarefas t
      WHERE t.pipeline_lead_id = NEW.id
        AND t.status NOT IN ('concluida','cancelada')
        AND t.created_at >= now() - interval '10 minutes'
    ) THEN
      INSERT INTO public.pipeline_tarefas (
        pipeline_lead_id,
        titulo,
        descricao,
        tipo,
        prioridade,
        status,
        responsavel_id,
        vence_em,
        hora_vencimento,
        created_by
      ) VALUES (
        NEW.id,
        'Ligar: ' || COALESCE(NULLIF(trim(NEW.nome), ''), 'Lead'),
        'Cadência Sem Contato — Tentativa 1: ' || COALESCE(v_passo.acao, 'Primeiro contato'),
        'ligacao',
        'media',
        'pendente',
        NEW.corretor_id,
        v_vence,
        v_hora,
        NEW.corretor_id
      );
    END IF;
  ELSIF (TG_OP = 'UPDATE')
        AND ( (OLD.stage_id = sem_contato AND NEW.stage_id IS DISTINCT FROM sem_contato) OR (NEW.arquivado IS TRUE) )
  THEN
    UPDATE public.lead_cadencia_sem_contato
       SET status = 'cancelada', proxima_em = NULL, updated_at = now()
     WHERE pipeline_lead_id = NEW.id AND status = 'ativa';
  END IF;
  RETURN NEW;
END;
$function$;