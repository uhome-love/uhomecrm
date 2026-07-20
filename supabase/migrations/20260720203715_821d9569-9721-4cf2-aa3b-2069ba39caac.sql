
DROP TRIGGER IF EXISTS trg_visita_stage_entry_tarefa ON public.pipeline_leads;
DROP FUNCTION IF EXISTS public.fn_visita_stage_entry_tarefa();

DO $$
DECLARE
  v_leads uuid[];
  v_lead uuid;
  v_creator uuid;
BEGIN
  SELECT array_agg(DISTINCT pt.pipeline_lead_id)
    INTO v_leads
  FROM public.pipeline_tarefas pt
  JOIN public.pipeline_leads pl ON pl.id = pt.pipeline_lead_id
  JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
  WHERE ps.tipo = 'visita'
    AND pt.status = 'pendente'
    AND pt.origem IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pipeline_tarefas pt2
       WHERE pt2.pipeline_lead_id = pt.pipeline_lead_id
         AND pt2.origem = 'visita_auto'
         AND pt2.status = 'pendente'
    );

  IF v_leads IS NULL THEN RETURN; END IF;

  UPDATE public.pipeline_tarefas pt
     SET status = 'cancelada', updated_at = now()
    FROM public.pipeline_leads pl, public.pipeline_stages ps
   WHERE pt.pipeline_lead_id = ANY(v_leads)
     AND pl.id = pt.pipeline_lead_id
     AND ps.id = pl.stage_id
     AND ps.tipo = 'visita'
     AND pt.status = 'pendente'
     AND pt.origem IS NULL;

  FOREACH v_lead IN ARRAY v_leads LOOP
    SELECT COALESCE(corretor_id, created_by)
      INTO v_creator
      FROM public.pipeline_leads WHERE id = v_lead;
    INSERT INTO public.pipeline_atividades
      (pipeline_lead_id, tipo, titulo, descricao, status, data, hora, created_by)
    VALUES
      (v_lead, 'sistema',
       'Tarefa manual duplicada cancelada',
       'A tarefa manual coexistia com uma tarefa automática do fluxo Visita. Mantida apenas a automação para evitar duplicidade.',
       'concluida',
       (now() AT TIME ZONE 'America/Sao_Paulo')::date,
       (now() AT TIME ZONE 'America/Sao_Paulo')::time,
       v_creator);
  END LOOP;
END $$;

SELECT public.fn_reconciliar_visita_auto();
