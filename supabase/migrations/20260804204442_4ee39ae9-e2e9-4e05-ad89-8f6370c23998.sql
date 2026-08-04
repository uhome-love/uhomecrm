DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT h.pipeline_lead_id AS lead_id, max(h.created_at) AS entrou_em
    FROM public.pipeline_historico h
    JOIN public.pipeline_leads l ON l.id = h.pipeline_lead_id
    WHERE h.stage_novo_id = '1ea43190-44c8-43ec-91b4-409b055b0e58'::uuid
      AND h.created_at > now() - interval '7 days'
    GROUP BY 1
  LOOP
    PERFORM public.enqueue_meta_capi_event(
      p_lead_id => r.lead_id,
      p_event_name => 'LeadQualificado',
      p_event_time => r.entrou_em,
      p_custom_data => '{}'::jsonb,
      p_lead_event_source => 'Qualificado'
    );
    n := n + 1;
  END LOOP;
  INSERT INTO public.ops_events (fn, level, category, message, ctx)
  VALUES ('backfill_leadqualificado', 'info', 'capi', 'backfill_concluido',
          jsonb_build_object('leads_processados', n));
END $$;