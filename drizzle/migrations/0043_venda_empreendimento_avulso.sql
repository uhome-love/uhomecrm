ALTER TABLE public.empreendimentos_canonicos ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'cadastro';

CREATE OR REPLACE FUNCTION public.criar_empreendimento_venda(p_nome text, p_construtora text, p_tipo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_nome text := regexp_replace(btrim(coalesce(p_nome,'')),'\s+',' ','g'); v_cons text := NULLIF(btrim(coalesce(p_construtora,'')),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'corretor')) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF length(v_nome) < 3 THEN RAISE EXCEPTION 'Informe o nome do imóvel ou empreendimento.'; END IF;
  IF p_tipo NOT IN ('empreendimento','avulso') THEN RAISE EXCEPTION 'Tipo inválido.'; END IF;
  IF v_cons IS NULL THEN v_cons := CASE WHEN p_tipo='avulso' THEN 'Imóvel de terceiros' END; END IF;
  IF v_cons IS NULL THEN RAISE EXCEPTION 'Informe a construtora.'; END IF;
  SELECT id INTO v_id FROM public.empreendimentos_canonicos WHERE lower(unaccent(nome)) = lower(unaccent(v_nome)) LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.empreendimentos_canonicos SET construtora = coalesce(NULLIF(btrim(construtora),''), v_cons) WHERE id=v_id;
    RETURN v_id;
  END IF;
  INSERT INTO public.empreendimentos_canonicos(nome, construtora, ativo, origem, created_by, ordem)
  VALUES (v_nome, v_cons, false, 'venda', auth.uid(), 9999) RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, acao, modulo, descricao, dados_depois)
  VALUES (auth.uid(), 'criar_empreendimento_venda', 'vendas', 'Empreendimento criado no registro de venda', jsonb_build_object('id',v_id,'nome',v_nome,'construtora',v_cons,'tipo',p_tipo));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.criar_empreendimento_venda(text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_empreendimento_venda(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validar_venda_completa(p_venda negocios)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_emp public.empreendimentos_canonicos; v_inter public.intermediacoes;
BEGIN
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=p_venda.empreendimento_canonico_id;
  IF NOT FOUND OR NULLIF(btrim(v_emp.construtora),'') IS NULL THEN RAISE EXCEPTION 'Selecione um empreendimento oficial com construtora.'; END IF;
  IF p_venda.construtora IS DISTINCT FROM v_emp.construtora OR p_venda.empreendimento IS DISTINCT FROM v_emp.nome THEN RAISE EXCEPTION 'Empreendimento e construtora devem corresponder ao cadastro oficial.'; END IF;
  IF NULLIF(btrim(p_venda.unidade),'') IS NULL THEN RAISE EXCEPTION 'Informe a unidade.'; END IF;
  IF p_venda.vgv_final IS NULL OR p_venda.vgv_final<=0 OR p_venda.vgv_final::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Informe o VGV final positivo.'; END IF;
  IF p_venda.data_assinatura IS NULL OR p_venda.data_assinatura>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe a data real da assinatura, sem data futura.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_venda.corretor_id AND user_id IS NOT NULL) THEN RAISE EXCEPTION 'A venda precisa de um corretor vinculado.'; END IF;
  SELECT * INTO v_inter FROM public.intermediacoes WHERE id=p_venda.intermediacao_id AND status='ativa';
  IF NOT FOUND OR v_inter.negocio_id IS DISTINCT FROM p_venda.id OR v_inter.pipeline_lead_id IS DISTINCT FROM p_venda.pipeline_lead_id THEN RAISE EXCEPTION 'Anexe uma intermediação ativa vinculada a este cliente e negócio.'; END IF;
  IF NULLIF(btrim(v_inter.arquivo_path),'') IS NULL OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='intermediacoes' AND name=v_inter.arquivo_path) THEN RAISE EXCEPTION 'O documento da intermediação não está disponível.'; END IF;
  IF lower(btrim(v_inter.unidade)) IS DISTINCT FROM lower(btrim(p_venda.unidade)) THEN RAISE EXCEPTION 'A unidade deve corresponder à intermediação anexada.'; END IF;
  IF NULLIF(btrim(p_venda.comprovante_ato_path),'') IS NULL OR NOT (p_venda.comprovante_ato_path LIKE p_venda.id::text||'/%' OR p_venda.comprovante_ato_path LIKE 'lead/'||p_venda.pipeline_lead_id::text||'/%') THEN RAISE EXCEPTION 'Anexe o comprovante do ato deste cliente.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='vendas-docs' AND name=p_venda.comprovante_ato_path AND metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png','image/webp')) THEN RAISE EXCEPTION 'O comprovante do ato deve existir e ser PDF ou imagem.'; END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.confirmar_venda(p_lead_id uuid, p_empreendimento_id uuid, p_unidade text, p_vgv numeric, p_data date, p_intermediacao_id uuid, p_comprovante_path text, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_lead public.pipeline_leads; v_neg public.negocios; v_inter public.intermediacoes; v_emp public.empreendimentos_canonicos; v_corretor uuid; v_gerente uuid; v_result jsonb; v_stage uuid; v_historica boolean:=false; v_diverge boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  SELECT * INTO v_neg FROM public.negocios WHERE pipeline_lead_id=p_lead_id AND status='ativo' AND (id=v_lead.negocio_id OR (v_lead.negocio_id IS NULL AND fase<>'ganho')) ORDER BY (id=v_lead.negocio_id) DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE;
  IF v_neg.id IS NOT NULL AND v_neg.fase='ganho' THEN
    IF v_neg.intermediacao_id IS NOT NULL AND v_neg.comprovante_ato_path IS NOT NULL THEN
      IF p_intermediacao_id IS DISTINCT FROM v_neg.intermediacao_id OR p_empreendimento_id IS DISTINCT FROM v_neg.empreendimento_canonico_id OR btrim(p_unidade) IS DISTINCT FROM v_neg.unidade OR p_vgv IS DISTINCT FROM v_neg.vgv_final OR p_data IS DISTINCT FROM v_neg.data_assinatura OR p_comprovante_path IS DISTINCT FROM v_neg.comprovante_ato_path THEN RAISE EXCEPTION 'Esta venda já foi confirmada. Abra Vendas para consultar os dados registrados.'; END IF;
      RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',true);
    END IF;
    IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Somente CEO ou diretora podem completar os documentos de uma venda antiga.'; END IF;
    IF p_vgv IS DISTINCT FROM COALESCE(v_neg.vgv_final,v_neg.vgv_estimado) OR p_data IS DISTINCT FROM v_neg.data_assinatura THEN RAISE EXCEPTION 'Complete os documentos sem alterar o VGV ou a data da venda antiga.'; END IF;
    v_historica:=true;
  END IF;
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=p_empreendimento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um empreendimento ou imóvel.'; END IF;
  SELECT * INTO v_inter FROM public.intermediacoes WHERE id=p_intermediacao_id FOR UPDATE;
  IF NOT FOUND OR v_inter.status<>'ativa' OR NOT COALESCE((v_inter.pipeline_lead_id=p_lead_id OR (v_neg.id IS NOT NULL AND v_inter.negocio_id=v_neg.id)),false) THEN RAISE EXCEPTION 'Selecione uma intermediação deste cliente.'; END IF;
  IF v_inter.negocio_id IS NOT NULL AND v_inter.negocio_id IS DISTINCT FROM v_neg.id THEN RAISE EXCEPTION 'Esta intermediação já está vinculada a outra venda.'; END IF;
  v_diverge := public.resolver_empreendimento_canonico(NULL,NULL,NULL,NULL,v_inter.empreendimento,NULL) IS DISTINCT FROM v_emp.id;
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
  IF v_diverge THEN
    INSERT INTO public.negocios_atividades(negocio_id,tipo,titulo,descricao,created_by) VALUES(v_neg.id,'divergencia_empreendimento','Empreendimento diferente da intermediação','Venda: '||v_emp.nome||' · Intermediação: '||coalesce(v_inter.empreendimento,'—'),auth.uid());
  END IF;
  RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',v_historica,'documentos_completados',v_historica,'divergencia_empreendimento',v_diverge);
END $function$;