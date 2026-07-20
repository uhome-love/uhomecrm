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

  -- Auto-cadência (Sem Contato) é isenta do teto — ela tem prazos próprios.
  IF NEW.origem = 'cadencia_sem_contato' THEN
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
    -- Aquecimento: 90 dias (coerente com prazo 30/60/90 do status).
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