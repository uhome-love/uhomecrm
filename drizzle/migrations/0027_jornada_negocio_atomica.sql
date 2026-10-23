ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS jornada jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.negocios.jornada IS 'Conferência documental informativa, previsão de assinatura e referência da situação do contrato; nunca representa assinatura oficial ou recebimento.';

CREATE OR REPLACE FUNCTION public.sincronizar_referencia_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tipo text; v_status text; v_anterior text;
BEGIN
  IF NEW.negocio_id IS NULL THEN RETURN NEW; END IF;
  SELECT tipo INTO v_tipo FROM public.pipeline_stages WHERE id=NEW.stage_id;
  v_status:=NEW.flag_status->>'status_contrato';
  v_anterior:=OLD.flag_status->>'status_contrato';
  IF v_tipo='contrato_gerado' AND v_status IN ('em_confeccao','gerado','em_leitura') THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.negocio_id IS DISTINCT FROM OLD.negocio_id OR v_status IS DISTINCT FROM v_anterior THEN
      UPDATE public.negocios SET jornada=COALESCE(jornada,'{}'::jsonb)||jsonb_build_object('contrato',jsonb_build_object('status',v_status,'desde',now(),'etapa_id',NEW.stage_id))
        WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase<>'ganho';
    END IF;
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR v_status IS DISTINCT FROM v_anterior THEN
    UPDATE public.negocios SET jornada=COALESCE(jornada,'{}'::jsonb)-'contrato'
      WHERE id=NEW.negocio_id AND pipeline_lead_id=NEW.id AND status='ativo' AND fase<>'ganho';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sincronizar_referencia_contrato() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_referencia_contrato AFTER UPDATE OF flag_status,stage_id,negocio_id ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.sincronizar_referencia_contrato();

CREATE OR REPLACE FUNCTION public.registrar_jornada_negocio(p_lead_id uuid,p_etapa_id uuid,p_dados jsonb,p_mover boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead public.pipeline_leads; v_neg public.negocios; v_emp public.empreendimentos_canonicos; v_tipo text; v_flags jsonb; v_docs jsonb; v_valor numeric; v_unidade text; v_status text; v_previsao date; v_obs text; v_corretor uuid; v_gerente uuid; v_jornada jsonb; v_titulo text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  IF v_lead.arquivado IS TRUE THEN RAISE EXCEPTION 'Cliente arquivado. Reative antes de iniciar uma negociação.'; END IF;
  SELECT tipo INTO v_tipo FROM public.pipeline_stages WHERE id=p_etapa_id AND ativo AND pipeline_tipo='leads';
  IF v_tipo IS NULL OR v_tipo NOT IN ('proposta','documentacao','contrato_gerado') THEN RAISE EXCEPTION 'Selecione uma etapa da jornada do negócio.'; END IF;
  IF NOT p_mover AND v_lead.stage_id IS DISTINCT FROM p_etapa_id THEN RAISE EXCEPTION 'A etapa mudou. Reabra o cliente antes de salvar.'; END IF;
  IF EXISTS(SELECT 1 FROM public.pipeline_stages WHERE id=v_lead.stage_id AND tipo='venda') THEN RAISE EXCEPTION 'Venda já assinada. Consulte os dados em Vendas.'; END IF;
  IF jsonb_typeof(p_dados) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados da jornada inválidos.'; END IF;
  SELECT * INTO v_neg FROM public.negocios WHERE pipeline_lead_id=p_lead_id AND status='ativo' AND (id=v_lead.negocio_id OR (v_lead.negocio_id IS NULL AND fase<>'ganho')) ORDER BY (id=v_lead.negocio_id) DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE;
  IF v_neg.fase='ganho' THEN RAISE EXCEPTION 'Venda já assinada. Reative o cliente para iniciar outro negócio.'; END IF;
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=NULLIF(p_dados->>'empreendimentoId','')::uuid AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um empreendimento oficial.'; END IF;
  v_unidade:=NULLIF(btrim(p_dados->>'unidade'),'');
  v_valor:=NULLIF(p_dados->>'valorProposta','')::numeric;
  IF v_tipo IN ('proposta','contrato_gerado') AND (v_unidade IS NULL OR v_valor IS NULL OR v_valor<=0) THEN RAISE EXCEPTION 'Informe a unidade e o valor da proposta.'; END IF;
  IF v_valor IS NOT NULL AND (v_valor<0 OR v_valor>999999999 OR v_valor::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Revise o valor da proposta.'; END IF;
  IF length(COALESCE(v_unidade,''))>150 THEN RAISE EXCEPTION 'Revise a unidade.'; END IF;
  v_docs:=COALESCE(p_dados->'documentos','{}'::jsonb);
  IF jsonb_typeof(v_docs) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(v_docs) d WHERE d.key NOT IN ('identidade','renda','residencia') OR jsonb_typeof(d.value)<>'boolean') THEN RAISE EXCEPTION 'Conferência documental inválida.'; END IF;
  v_status:=p_dados->>'status';
  IF v_tipo='contrato_gerado' THEN
    IF v_status IS NULL OR v_status NOT IN ('em_confeccao','gerado','em_leitura') THEN RAISE EXCEPTION 'Selecione a situação do contrato.'; END IF;
  ELSE
    IF v_status IS NULL OR v_status NOT IN ('proposta_enviada','proposta_aprovada','aprovacao_bancaria','correspondente_bancario','aprovacao_proprietario','documentacao_enviada') THEN RAISE EXCEPTION 'Selecione a situação da negociação.'; END IF;
  END IF;
  v_obs:=NULLIF(btrim(p_dados->>'observacao'),'');
  IF length(COALESCE(v_obs,''))>5000 THEN RAISE EXCEPTION 'A observação deve ter até 5000 caracteres.'; END IF;
  v_previsao:=NULLIF(p_dados->>'previsaoAssinatura','')::date;
  IF v_neg.id IS NULL THEN
    SELECT id INTO v_corretor FROM public.profiles WHERE user_id=v_lead.corretor_id;
    SELECT id INTO v_gerente FROM public.profiles WHERE user_id=v_lead.gerente_id;
    IF v_corretor IS NULL THEN RAISE EXCEPTION 'Vincule o cliente a um responsável antes de iniciar o negócio.'; END IF;
    INSERT INTO public.negocios(nome_cliente,telefone,pipeline_lead_id,corretor_id,gerente_id,empreendimento,empreendimento_canonico_id,construtora,unidade,vgv_estimado,fase,status,origem)
      VALUES(v_lead.nome,v_lead.telefone,p_lead_id,v_corretor,v_gerente,v_emp.nome,v_emp.id,v_emp.construtora,v_unidade,v_valor,CASE WHEN v_tipo='contrato_gerado' THEN 'contrato' ELSE 'em_negociacao' END,'ativo','pipeline_convertido') RETURNING * INTO v_neg;
  END IF;
  v_jornada:=COALESCE(v_neg.jornada,'{}'::jsonb)||jsonb_build_object('documentos',v_docs,'previsao_assinatura',v_previsao);
  v_flags:=COALESCE(v_lead.flag_status,'{}'::jsonb);
  IF v_tipo='contrato_gerado' THEN v_flags:=v_flags||jsonb_build_object('status_contrato',v_status);
  ELSE v_flags:=v_flags||jsonb_build_object('status_negociacao',v_status); END IF;
  UPDATE public.negocios SET empreendimento=v_emp.nome,empreendimento_canonico_id=v_emp.id,construtora=v_emp.construtora,
    unidade=v_unidade,proposta_valor=CASE WHEN v_valor>0 THEN v_valor ELSE proposta_valor END,
    vgv_estimado=CASE WHEN v_valor>0 THEN v_valor ELSE vgv_estimado END,
    proposta_situacao=CASE WHEN v_tipo<>'contrato_gerado' THEN v_status ELSE proposta_situacao END,
    contrato_situacao=CASE WHEN v_tipo='contrato_gerado' THEN v_status ELSE contrato_situacao END,
    observacoes=v_obs,jornada=v_jornada,
    fase=CASE WHEN v_tipo='contrato_gerado' THEN 'contrato' ELSE 'em_negociacao' END,updated_at=now() WHERE id=v_neg.id;
  UPDATE public.pipeline_leads SET negocio_id=v_neg.id,flag_status=v_flags,
    stage_id=CASE WHEN p_mover THEN p_etapa_id ELSE stage_id END,
    stage_changed_at=CASE WHEN p_mover AND stage_id IS DISTINCT FROM p_etapa_id THEN now() ELSE stage_changed_at END,
    valor_estimado=CASE WHEN v_valor>0 THEN v_valor ELSE valor_estimado END,ultima_acao_at=now()
    WHERE id=p_lead_id;
  v_titulo:=CASE v_tipo WHEN 'proposta' THEN 'Proposta registrada' WHEN 'documentacao' THEN 'Documentação conferida' ELSE 'Contrato atualizado' END;
  IF p_mover AND v_lead.stage_id IS DISTINCT FROM p_etapa_id THEN
    INSERT INTO public.pipeline_historico(pipeline_lead_id,stage_anterior_id,stage_novo_id,movido_por,observacao) VALUES(p_lead_id,v_lead.stage_id,p_etapa_id,auth.uid(),v_titulo||' · '||v_emp.nome||COALESCE(' · Unidade: '||v_unidade,'')||COALESCE(' · '||v_obs,''));
  END IF;
  INSERT INTO public.negocios_atividades(negocio_id,tipo,titulo,descricao,created_by) VALUES(v_neg.id,'jornada',v_titulo,v_emp.nome||COALESCE(' · Unidade: '||v_unidade,'')||COALESCE(' · Valor: '||v_valor::text,'')||' · Situação: '||v_status||COALESCE(' · '||v_obs,''),auth.uid());
  INSERT INTO public.pipeline_atividades(pipeline_lead_id,tipo,titulo,descricao,created_by,responsavel_id) VALUES(p_lead_id,'sistema',v_titulo,v_emp.nome||COALESCE(' · Unidade: '||v_unidade,'')||COALESCE(' · Valor: '||v_valor::text,'')||' · Situação: '||v_status||COALESCE(' · '||v_obs,''),auth.uid(),v_lead.corretor_id);
  RETURN jsonb_build_object('negocio_id',v_neg.id,'stage_id',CASE WHEN p_mover THEN p_etapa_id ELSE v_lead.stage_id END);
END $$;
REVOKE ALL ON FUNCTION public.registrar_jornada_negocio(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_jornada_negocio(uuid,uuid,jsonb,boolean) TO authenticated;
