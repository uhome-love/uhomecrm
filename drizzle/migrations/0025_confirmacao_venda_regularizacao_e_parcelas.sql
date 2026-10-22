CREATE OR REPLACE FUNCTION public.confirmar_venda(p_lead_id uuid,p_empreendimento_id uuid,p_unidade text,p_vgv numeric,p_data date,p_intermediacao_id uuid,p_comprovante_path text,p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lead public.pipeline_leads; v_neg public.negocios; v_inter public.intermediacoes; v_emp public.empreendimentos_canonicos; v_corretor uuid; v_gerente uuid; v_result jsonb; v_stage uuid; v_historica boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  SELECT * INTO v_neg FROM public.negocios WHERE pipeline_lead_id=p_lead_id AND status='ativo' AND (id=v_lead.negocio_id OR v_lead.negocio_id IS NULL) ORDER BY (id=v_lead.negocio_id) DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE;
  IF v_neg.id IS NOT NULL AND v_neg.fase='ganho' THEN
    IF v_neg.intermediacao_id IS NOT NULL AND v_neg.comprovante_ato_path IS NOT NULL THEN RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',true); END IF;
    IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Somente CEO ou diretora podem completar os documentos de uma venda antiga.'; END IF;
    IF p_vgv IS DISTINCT FROM COALESCE(v_neg.vgv_final,v_neg.vgv_estimado) OR p_data IS DISTINCT FROM v_neg.data_assinatura THEN RAISE EXCEPTION 'Complete os documentos sem alterar o VGV ou a data da venda antiga.'; END IF;
    v_historica:=true;
  END IF;
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=p_empreendimento_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um empreendimento oficial.'; END IF;
  SELECT * INTO v_inter FROM public.intermediacoes WHERE id=p_intermediacao_id FOR UPDATE;
  IF NOT FOUND OR v_inter.status<>'ativa' OR NOT COALESCE((v_inter.pipeline_lead_id=p_lead_id OR (v_neg.id IS NOT NULL AND v_inter.negocio_id=v_neg.id)),false) THEN RAISE EXCEPTION 'Selecione uma intermediação deste cliente.'; END IF;
  IF v_inter.negocio_id IS NOT NULL AND v_inter.negocio_id IS DISTINCT FROM v_neg.id THEN RAISE EXCEPTION 'Esta intermediação já está vinculada a outra venda.'; END IF;
  IF public.resolver_empreendimento_canonico(NULL,NULL,NULL,NULL,v_inter.empreendimento,NULL) IS DISTINCT FROM v_emp.id THEN RAISE EXCEPTION 'O empreendimento deve corresponder à intermediação.'; END IF;
  IF v_neg.id IS NULL THEN
    SELECT id INTO v_corretor FROM public.profiles WHERE user_id=v_lead.corretor_id;
    SELECT id INTO v_gerente FROM public.profiles WHERE user_id=v_lead.gerente_id;
    IF v_corretor IS NULL THEN RAISE EXCEPTION 'Vincule o cliente a um corretor antes de confirmar a venda.'; END IF;
    INSERT INTO public.negocios(nome_cliente,telefone,pipeline_lead_id,corretor_id,gerente_id,empreendimento,empreendimento_canonico_id,construtora,unidade,vgv_estimado,fase,status,origem)
      VALUES(v_lead.nome,v_lead.telefone,p_lead_id,v_corretor,v_gerente,v_emp.nome,v_emp.id,v_emp.construtora,p_unidade,p_vgv,'contrato','ativo','pipeline_convertido') RETURNING * INTO v_neg;
  END IF;
  UPDATE public.intermediacoes SET negocio_id=v_neg.id,pipeline_lead_id=p_lead_id WHERE id=v_inter.id;
  UPDATE public.negocios SET empreendimento=v_emp.nome,empreendimento_canonico_id=v_emp.id,construtora=v_emp.construtora,unidade=btrim(p_unidade),vgv_final=p_vgv,data_assinatura=p_data,intermediacao_id=v_inter.id,comprovante_ato_path=p_comprovante_path,fase='ganho',status='ativo',updated_at=now() WHERE id=v_neg.id RETURNING * INTO v_neg;
  PERFORM public.validar_venda_completa(v_neg);
  IF NOT v_historica THEN
    UPDATE public.negocios_recebimentos SET negocio_id=v_neg.id WHERE intermediacao_id=v_inter.id AND negocio_id IS NULL;
    v_result:=public.consolidar_lead_ganho(v_neg.id);
    IF NOT COALESCE((v_result->>'success')::boolean,false) THEN RAISE EXCEPTION 'Não foi possível consolidar o cliente como Ganho: %',v_result->>'reason'; END IF;
    SELECT stage_id INTO v_stage FROM public.pipeline_leads WHERE id=p_lead_id;
    INSERT INTO public.pipeline_historico(pipeline_lead_id,stage_anterior_id,stage_novo_id,movido_por,observacao) VALUES(p_lead_id,v_lead.stage_id,v_stage,auth.uid(),COALESCE(NULLIF(btrim(p_observacao),''),'Venda assinada com intermediação e comprovante do ato.'));
  END IF;
  INSERT INTO public.negocios_atividades(negocio_id,tipo,titulo,descricao,created_by) VALUES(v_neg.id,CASE WHEN v_historica THEN 'documentos_completados' ELSE 'venda_confirmada' END,CASE WHEN v_historica THEN 'Documentos da venda completados' ELSE 'Venda assinada' END,COALESCE(p_observacao,'Dados oficiais, intermediação e comprovante do ato conferidos.'),auth.uid());
  RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',v_historica);
END $$;

CREATE OR REPLACE FUNCTION public.venda_intermediacoes(p_lead_id uuid)
RETURNS TABLE(id uuid,comprador_nome text,empreendimento text,unidade text,vgv numeric,filename text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  RETURN QUERY SELECT i.id,i.comprador_nome,i.empreendimento,i.unidade,i.vgv,i.filename FROM public.intermediacoes i
    WHERE i.status='ativa' AND (i.pipeline_lead_id=p_lead_id OR i.negocio_id IN (SELECT n.id FROM public.negocios n WHERE n.pipeline_lead_id=p_lead_id AND n.status='ativo'))
    ORDER BY i.created_at DESC;
END $$;