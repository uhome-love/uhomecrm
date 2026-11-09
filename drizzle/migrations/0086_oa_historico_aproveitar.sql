CREATE OR REPLACE FUNCTION public.oa_historico_aproveitar(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lead oferta_ativa_leads%ROWTYPE;
  v_tel text; v_email text;
  v_pl record;
  v_nome text;
  v_stage uuid;
  v_pl_id uuid;
  v_attempt uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'status','sem_login'); END IF;
  IF NOT EXISTS (SELECT 1 FROM oferta_ativa_tentativas WHERE lead_id=p_lead_id AND corretor_id=v_uid) THEN
    RETURN jsonb_build_object('ok',false,'status','sem_ligacao');
  END IF;
  SELECT * INTO v_lead FROM oferta_ativa_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'status','nao_encontrado'); END IF;

  v_tel := public.normalize_telefone(v_lead.telefone);
  v_email := NULLIF(lower(btrim(v_lead.email)),'');
  IF v_tel IS NOT NULL AND public.contato_bloqueado(v_lead.telefone) THEN
    RETURN jsonb_build_object('ok',false,'status','bloqueado');
  END IF;

  SELECT id, corretor_id INTO v_pl FROM pipeline_leads
   WHERE ((v_tel IS NOT NULL AND telefone_normalizado=v_tel) OR (v_email IS NOT NULL AND lower(email)=v_email))
     AND aceite_status <> 'descartado'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    IF v_pl.corretor_id = v_uid THEN
      RETURN jsonb_build_object('ok',false,'status','comigo','pipeline_lead_id',v_pl.id);
    END IF;
    SELECT nome INTO v_nome FROM profiles WHERE user_id=v_pl.corretor_id LIMIT 1;
    RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',coalesce(split_part(v_nome,' ',1)||' '||coalesce(left(nullif(split_part(v_nome,' ',2),''),1)||'.',''),'outro corretor'));
  END IF;

  IF v_lead.status='aproveitado' AND v_lead.corretor_id IS DISTINCT FROM v_uid THEN
    SELECT nome INTO v_nome FROM profiles WHERE user_id=v_lead.corretor_id LIMIT 1;
    RETURN jsonb_build_object('ok',false,'status','com_outro','corretor_nome',coalesce(split_part(v_nome,' ',1),'outro corretor'));
  END IF;

  SELECT id INTO v_stage FROM pipeline_stages WHERE ativo=true AND nome='Novo Lead' LIMIT 1;
  INSERT INTO pipeline_leads (nome, telefone, email, empreendimento, origem, corretor_id, stage_id, observacoes, aceite_status)
  VALUES (coalesce(v_lead.nome,'Sem nome'), v_lead.telefone, v_lead.email, v_lead.empreendimento, 'Oferta Ativa', v_uid, v_stage,
          'Lead criado via Oferta Ativa (Aproveitado pelo histórico de ligações — cliente retornou depois).', 'aceito')
  RETURNING id INTO v_pl_id;

  UPDATE oferta_ativa_leads SET status='aproveitado', corretor_id=v_uid, interesse_tipo='com_interesse',
    em_atendimento_por=NULL, em_atendimento_ate=NULL WHERE id=p_lead_id;

  INSERT INTO oferta_ativa_tentativas (lead_id, corretor_id, lista_id, empreendimento, canal, resultado, feedback, pontos)
  VALUES (p_lead_id, v_uid, v_lead.lista_id, v_lead.empreendimento, 'retorno', 'com_interesse', 'Aproveitado pelo histórico (cliente retornou)', 3)
  RETURNING id INTO v_attempt;

  INSERT INTO oa_events (event_type, user_id, lead_id, lista_id, attempt_id, metadata)
  VALUES ('lead_aproveitado_historico', v_uid, p_lead_id, v_lead.lista_id, v_attempt, jsonb_build_object('pipeline_lead_id', v_pl_id));

  RETURN jsonb_build_object('ok',true,'status','aproveitado','pipeline_lead_id',v_pl_id);
END;
$$;

REVOKE ALL ON FUNCTION public.oa_historico_aproveitar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oa_historico_aproveitar(uuid) TO authenticated;