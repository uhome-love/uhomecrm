DO $test$
DECLARE v_lead_id uuid; v_result jsonb;
BEGIN
 SELECT pl.id INTO v_lead_id FROM public.pipeline_leads pl JOIN public.pipeline_stages ps ON ps.id=pl.stage_id WHERE ps.tipo='venda' AND pl.aceite_status='aceito' LIMIT 1;
 SELECT public.distribuir_lead_atomico(v_lead_id,NULL,NULL,true) INTO v_result;
 IF COALESCE((v_result->>'success')::boolean,true) OR COALESCE(v_result->>'reason','') <> 'lead_ganho' THEN RAISE EXCEPTION 'Distribuição não bloqueou: %',v_result; END IF;
END;
$test$;