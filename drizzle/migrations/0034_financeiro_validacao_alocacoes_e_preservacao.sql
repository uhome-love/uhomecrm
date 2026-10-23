REVOKE INSERT ON public.intermediacoes FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.intermediacao_beneficiarios,public.negocios_recebimentos FROM authenticated;
CREATE OR REPLACE FUNCTION public.intermediacao_validar_alocacoes(p_registro jsonb,p_beneficiarios jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_bruto numeric:=(p_registro->>'valor_bruto')::numeric; v_liquido numeric:=(p_registro->>'valor_liquido')::numeric; v_forma text:=p_registro->>'forma_pagamento'; v_soma numeric:=0; v_prev numeric:=0; v_total numeric:=0; v_desc_total numeric; v_desc_prev numeric:=0; v_desc_acum numeric:=0; v_item jsonb; v_pct numeric; v_val numeric; v_desconto numeric; v_uid uuid; v_papel text;
BEGIN
 IF v_bruto IS NULL OR v_liquido IS NULL OR v_bruto<=0 OR v_bruto::text IN('NaN','Infinity','-Infinity') OR v_liquido::text IN('NaN','Infinity','-Infinity') OR jsonb_typeof(p_beneficiarios) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Valores financeiros inválidos.'; END IF;
 v_desc_total:=CASE WHEN v_forma='nota_fiscal' THEN round(v_bruto*0.1,2) ELSE 0 END;
 IF v_liquido IS DISTINCT FROM v_bruto-v_desc_total THEN RAISE EXCEPTION 'O líquido deve corresponder ao bruto menos o desconto.'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_beneficiarios) LOOP
  v_pct:=(v_item->>'percentual')::numeric; v_papel:=v_item->>'papel'; v_uid:=NULLIF(v_item->>'user_id','')::uuid;
  IF v_pct IS NULL OR v_pct<0 OR v_pct>100 OR v_pct::text IN('NaN','Infinity','-Infinity') OR v_papel IS NULL OR v_papel NOT IN('corretor','gerente','diretora','diretoria','uhome') THEN RAISE EXCEPTION 'Percentual ou papel inválido.'; END IF;
  IF v_papel IN('corretor','gerente') AND (v_uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_uid AND role=CASE WHEN v_papel='corretor' THEN 'corretor'::public.app_role ELSE 'gestor'::public.app_role END)) THEN RAISE EXCEPTION 'Selecione o corretor ou gerente oficial.'; END IF;
  IF v_papel IN('diretora','diretoria','uhome') AND v_uid IS NOT NULL THEN RAISE EXCEPTION 'Beneficiário institucional inválido.'; END IF;
  v_soma:=v_soma+v_pct; v_val:=round(v_bruto*v_soma/100,2)-v_prev; v_prev:=v_prev+v_val;
  v_desc_acum:=v_desc_acum+v_val; v_desconto:=round(v_desc_total*v_desc_acum/v_bruto,2)-v_desc_prev; v_desc_prev:=v_desc_prev+v_desconto;
  IF (v_item->>'valor_bruto')::numeric IS DISTINCT FROM v_val OR (v_item->>'desconto')::numeric IS DISTINCT FROM v_desconto OR (v_item->>'valor_liquido')::numeric IS DISTINCT FROM v_val-v_desconto THEN RAISE EXCEPTION 'A divisão deve corresponder aos percentuais e ao desconto por pessoa.'; END IF;
 END LOOP;
 IF v_soma<>100 OR v_prev<>v_bruto OR v_desc_prev<>v_desc_total THEN RAISE EXCEPTION 'A divisão deve fechar exatamente a comissão.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_beneficiarios)x WHERE x->>'papel' IN('corretor','gerente') GROUP BY x->>'user_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Não repita o mesmo beneficiário.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.intermediacao_validar_alocacoes(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.intermediacao_validar_registro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_b jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.origem='sistema' THEN
  v_b:=NEW.payload->'beneficiarios_validos';
  IF v_b IS NULL THEN RAISE EXCEPTION 'Crie a intermediação pela operação completa.'; END IF;
  PERFORM public.intermediacao_validar_alocacoes(to_jsonb(NEW),v_b);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER intermediacao_alocacoes_guard BEFORE INSERT ON public.intermediacoes FOR EACH ROW EXECUTE FUNCTION public.intermediacao_validar_registro();
CREATE OR REPLACE FUNCTION public.financeiro_registrar_repasse(p_recebimento uuid,p_beneficiario uuid,p_data date,p_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_r public.negocios_recebimentos; v_b public.intermediacao_beneficiarios; v_i public.intermediacoes; v_valor numeric; v_id uuid; v_antes numeric;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_r FROM public.negocios_recebimentos WHERE id=p_recebimento FOR UPDATE;
 SELECT * INTO v_i FROM public.intermediacoes WHERE id=v_r.intermediacao_id AND status='ativa';
 SELECT * INTO v_b FROM public.intermediacao_beneficiarios WHERE id=p_beneficiario AND intermediacao_id=v_i.id;
 IF v_r.id IS NULL OR v_r.status<>'recebido' OR v_i.id IS NULL OR v_i.forma_pagamento<>'nota_fiscal' OR v_b.id IS NULL OR v_b.papel='uhome' OR NOT EXISTS(SELECT 1 FROM public.negocios WHERE id=v_r.negocio_id AND fase='ganho' AND status='ativo') THEN RAISE EXCEPTION 'Repasse exige parcela de Nota fiscal recebida e beneficiário desta intermediação.'; END IF;
 IF p_data IS NULL OR p_data<v_r.recebido_em OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'A data do repasse deve ficar entre o recebimento e hoje.'; END IF;
 PERFORM public.financeiro_validar_comprovante(p_path,v_r.negocio_id);
 SELECT COALESCE(sum(valor),0) INTO v_antes FROM public.negocios_recebimentos WHERE intermediacao_id=v_i.id AND status<>'cancelado' AND (parcela_num<v_r.parcela_num OR (parcela_num=v_r.parcela_num AND id<v_r.id));
 v_valor:=round(v_b.valor_liquido*(v_antes+v_r.valor)/NULLIF(COALESCE(v_i.valor_bruto,v_i.valor_comissao),0),2)-round(v_b.valor_liquido*v_antes/NULLIF(COALESCE(v_i.valor_bruto,v_i.valor_comissao),0),2);
 IF v_valor IS NULL OR v_valor<=0 THEN RAISE EXCEPTION 'A divisão da intermediação precisa ser conferida.'; END IF;
 INSERT INTO public.financeiro_repasses(recebimento_id,beneficiario_id,valor,pago_em,comprovante_path,created_by) VALUES(v_r.id,v_b.id,v_valor,p_data,p_path,auth.uid()) ON CONFLICT(recebimento_id,beneficiario_id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.financeiro_repasses WHERE recebimento_id=v_r.id AND beneficiario_id=v_b.id; END IF; RETURN v_id;
END $$;
CREATE POLICY intermediacao_gestao_escopo ON public.intermediacoes AS RESTRICTIVE FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR (pipeline_lead_id IS NOT NULL AND public.can_access_lead(pipeline_lead_id)) OR created_by=auth.uid());
CREATE OR REPLACE FUNCTION public.intermediacao_documento_acessivel(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR EXISTS(SELECT 1 FROM public.intermediacoes i WHERE i.arquivo_path=p_name AND (i.created_by=auth.uid() OR public.can_access_lead(i.pipeline_lead_id))) $$;
CREATE POLICY intermediacao_storage_escopo ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'intermediacoes' OR public.intermediacao_documento_acessivel(name));