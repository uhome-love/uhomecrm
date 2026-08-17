DO $test$
DECLARE
  v_profile record;
  v_stage_new uuid;
  v_lead uuid := gen_random_uuid();
  v_negocio uuid := gen_random_uuid();
  v_blocked boolean := false;
  v_row record;
BEGIN
  SELECT id,user_id INTO v_profile FROM public.profiles WHERE user_id IS NOT NULL AND ativo=true LIMIT 1;
  SELECT id INTO v_stage_new FROM public.pipeline_stages WHERE tipo='novo_lead' AND ativo=true ORDER BY ordem LIMIT 1;

  INSERT INTO public.pipeline_leads(id,nome,stage_id,corretor_id,aceite_status,arquivado,created_at,updated_at)
  VALUES(v_lead,'TESTE VALIDACAO VENDA GANHA',v_stage_new,v_profile.user_id,'pendente',false,now(),now());
  INSERT INTO public.negocios(id,pipeline_lead_id,corretor_id,nome_cliente,fase,status,data_assinatura,vgv_final,created_at,updated_at)
  VALUES(v_negocio,v_lead,v_profile.id,'TESTE VALIDACAO VENDA GANHA','ganho','ativo',CURRENT_DATE,1,now(),now());

  SELECT pl.aceite_status,pl.corretor_id,pl.negocio_id,ps.tipo stage_tipo,pl.aceite_expira_em,pl.arquivado
  INTO v_row FROM public.pipeline_leads pl JOIN public.pipeline_stages ps ON ps.id=pl.stage_id WHERE pl.id=v_lead;
  IF v_row.aceite_status<>'aceito' OR v_row.corretor_id IS DISTINCT FROM v_profile.user_id OR v_row.negocio_id IS DISTINCT FROM v_negocio OR v_row.stage_tipo<>'venda' OR v_row.aceite_expira_em IS NOT NULL OR v_row.arquivado THEN
    RAISE EXCEPTION 'Falha na consolidação ponta a ponta';
  END IF;

  BEGIN
    UPDATE public.pipeline_leads SET corretor_id=NULL,aceite_status='pendente_distribuicao' WHERE id=v_lead;
  EXCEPTION WHEN check_violation THEN v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'A guarda universal não bloqueou a regressão'; END IF;

  DELETE FROM public.negocios_atividades WHERE negocio_id=v_negocio;
  DELETE FROM public.negocios WHERE id=v_negocio;
  DELETE FROM public.pipeline_leads WHERE id=v_lead;
END;
$test$;