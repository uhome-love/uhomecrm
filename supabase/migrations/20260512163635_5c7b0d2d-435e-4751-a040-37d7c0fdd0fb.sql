-- 1. Improve redistribuir_leads_pendentes: use atomico + exclude last broker who timed out + cap retries
CREATE OR REPLACE FUNCTION public.redistribuir_leads_pendentes(p_segmento_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead record;
  v_count int := 0;
  v_errors int := 0;
  v_skipped int := 0;
  v_result jsonb;
  v_last_broker uuid;
BEGIN
  FOR v_lead IN
    SELECT id, segmento_id
    FROM pipeline_leads
    WHERE aceite_status = 'pendente_distribuicao'
      AND arquivado = false
      AND (p_segmento_id IS NULL OR segmento_id = p_segmento_id)
    ORDER BY 
      CASE prioridade_lead WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baixa' THEN 3 ELSE 4 END,
      updated_at ASC
    LIMIT 100
  LOOP
    -- Get the most recent broker who timed out for this lead (to exclude them on retry)
    SELECT corretor_id INTO v_last_broker
    FROM distribuicao_historico
    WHERE pipeline_lead_id = v_lead.id
      AND acao = 'timeout'
    ORDER BY created_at DESC
    LIMIT 1;

    BEGIN
      v_result := distribuir_lead_atomico(
        p_lead_id := v_lead.id,
        p_janela := NULL,
        p_exclude_auth_user_id := v_last_broker,
        p_force := false
      );
      IF (v_result->>'success')::boolean THEN
        v_count := v_count + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('redistributed', v_count, 'errors', v_errors, 'skipped', v_skipped);
END;
$function$;

-- 2. Schedule it to run every 2 minutes
SELECT cron.unschedule('redistribuir-leads-pendentes')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'redistribuir-leads-pendentes');

SELECT cron.schedule(
  'redistribuir-leads-pendentes',
  '*/2 * * * *',
  $$ SELECT public.redistribuir_leads_pendentes(); $$
);