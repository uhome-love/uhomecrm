CREATE OR REPLACE FUNCTION public.oa_liberar_lead(p_lead_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
  UPDATE oferta_ativa_leads SET em_atendimento_por = NULL, em_atendimento_ate = NULL
   WHERE id = p_lead_id AND em_atendimento_por = v_uid;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.oa_liberar_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_liberar_lead(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.oa_anotar_pipeline(p_lead_id uuid, p_titulo text, p_nota text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_oa oferta_ativa_leads%ROWTYPE; v_pl record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO v_oa FROM oferta_ativa_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  SELECT * INTO v_pl FROM public._oa_cliente_pipeline(public.normalize_telefone(v_oa.telefone), NULLIF(lower(btrim(v_oa.email)),''), NULL);
  IF v_pl.id IS NULL OR v_pl.corretor_id IS DISTINCT FROM v_uid THEN RETURN jsonb_build_object('ok',true,'anotado',false); END IF;
  INSERT INTO pipeline_atividades (pipeline_lead_id, created_by, tipo, titulo, descricao, status, prioridade, data)
  VALUES (v_pl.id, v_uid, 'contato', left(p_titulo,200), NULLIF(left(p_nota,2000),''), 'concluida', 'normal', (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  UPDATE pipeline_leads SET ultima_acao_at = now() WHERE id = v_pl.id;
  RETURN jsonb_build_object('ok',true,'anotado',true);
END $$;
REVOKE ALL ON FUNCTION public.oa_anotar_pipeline(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_anotar_pipeline(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bolsao_registrar(p_lead_id uuid, p_resultado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid:=auth.uid(); v_res public.bolsao_reservas; v_descarte uuid;
BEGIN
 SELECT * INTO v_res FROM public.bolsao_reservas WHERE pipeline_lead_id=p_lead_id FOR UPDATE;
 IF v_uid IS NULL OR v_res IS NULL OR v_res.corretor_id IS DISTINCT FROM v_uid THEN
   RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada');
 END IF;
 IF p_resultado='liberar' THEN
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_resultado='pular' THEN
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,
     cooldown_ate=greatest(coalesce(cooldown_ate, now()), now()+interval '30 minutes'),updated_at=now()
    WHERE pipeline_lead_id=p_lead_id;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF v_res.reservado_ate IS NULL THEN
   IF v_res.ultimo_resultado=p_resultado THEN RETURN jsonb_build_object('ok',true,'idempotent',true); END IF;
   RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada');
 END IF;
 IF v_res.reservado_ate<=now() THEN RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada'); END IF;
 IF p_resultado='nao_atendeu' THEN
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,cooldown_ate=now()+interval '24 hours',ultimo_resultado='nao_atendeu',tentativas=tentativas+1,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
 ELSIF p_resultado='sem_interesse' THEN
   SELECT id INTO v_descarte FROM public.pipeline_stages WHERE tipo='descarte' AND pipeline_tipo='leads' ORDER BY ordem LIMIT 1;
   UPDATE public.pipeline_leads SET stage_id=coalesce(v_descarte,stage_id),stage_changed_at=now(),tipo_descarte='definitivo',motivo_descarte='Sem interesse (Bolsão)',arquivado=true,estagnado=false,updated_at=now() WHERE id=p_lead_id;
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,ultimo_resultado='sem_interesse',tentativas=tentativas+1,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
 ELSE RETURN jsonb_build_object('ok',false,'error','resultado_invalido');
 END IF;
 RETURN jsonb_build_object('ok',true);
END $$;