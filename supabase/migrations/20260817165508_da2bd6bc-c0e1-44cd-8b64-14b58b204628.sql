DO $test$
DECLARE v_lead_id uuid; v_corretor_id uuid; v_result jsonb;
BEGIN
 SELECT pl.id,pl.corretor_id INTO v_lead_id,v_corretor_id FROM public.pipeline_leads pl JOIN public.pipeline_stages ps ON ps.id=pl.stage_id WHERE ps.tipo='venda' AND pl.aceite_status='aceito' AND pl.corretor_id IS NOT NULL LIMIT 1;
 SELECT public.rejeitar_lead(v_lead_id,v_corretor_id,'teste_guarda') INTO v_result;
 IF COALESCE((v_result->>'success')::boolean,true) OR v_result->>'reason'<>'lead_final_blocked' THEN
   RAISE EXCEPTION 'Rejeição não bloqueou venda ganha: %',v_result;
 END IF;
END;
$test$;