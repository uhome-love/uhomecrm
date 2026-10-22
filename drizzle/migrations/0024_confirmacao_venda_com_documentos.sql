CREATE OR REPLACE FUNCTION public.vendas_docs_pode(p_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') THEN RETURN true; END IF;
  BEGIN
    IF split_part(p_name,'/',1)='lead' THEN
      v_id:=split_part(p_name,'/',2)::uuid;
      RETURN public.can_access_lead(v_id);
    END IF;
    v_id:=split_part(p_name,'/',1)::uuid;
  EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.can_access_negocio(v_id);
END $$;

CREATE OR REPLACE FUNCTION public.validar_venda_completa(p_venda public.negocios)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp public.empreendimentos_canonicos; v_inter public.intermediacoes;
BEGIN
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=p_venda.empreendimento_canonico_id AND ativo;
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
END $$;
REVOKE ALL ON FUNCTION public.validar_venda_completa(public.negocios) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guardar_venda_assinada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nova boolean;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.fase='ganho' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Venda assinada não pode ser excluída. Distrato somente no Financeiro pelo CEO ou diretora.'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.fase='ganho' AND COALESCE(OLD.status,'ativo')='ativo' AND (NEW.fase IS DISTINCT FROM OLD.fase OR NEW.status IS DISTINCT FROM OLD.status OR NEW.distrato_em IS DISTINCT FROM OLD.distrato_em OR NEW.distrato_motivo IS DISTINCT FROM OLD.distrato_motivo OR NEW.distrato_por IS DISTINCT FROM OLD.distrato_por) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Distrato somente no Financeiro pelo CEO ou diretora.';
  END IF;
  v_nova:=NEW.fase='ganho';
  IF TG_OP='UPDATE' THEN
    v_nova:=NEW.fase='ganho' AND (OLD.fase IS DISTINCT FROM 'ganho' OR (COALESCE(NEW.status,'ativo')='ativo' AND COALESCE(OLD.status,'ativo')<>'ativo'));
  END IF;
  IF v_nova THEN PERFORM public.validar_venda_completa(NEW); END IF;
  IF TG_OP='UPDATE' AND OLD.fase='ganho' AND auth.uid() IS NOT NULL THEN
    IF (OLD.comprovante_ato_path IS NOT NULL AND NEW.comprovante_ato_path IS DISTINCT FROM OLD.comprovante_ato_path) OR (OLD.intermediacao_id IS NOT NULL AND NEW.intermediacao_id IS DISTINCT FROM OLD.intermediacao_id) THEN RAISE EXCEPTION 'Os anexos da venda assinada devem ser preservados.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_guardar_venda_assinada BEFORE INSERT OR UPDATE OR DELETE ON public.negocios FOR EACH ROW EXECUTE FUNCTION public.guardar_venda_assinada();

CREATE OR REPLACE FUNCTION public.guardar_etapa_venda_completa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pipeline_stages WHERE id=NEW.stage_id AND tipo='venda' AND pipeline_tipo='leads') AND (TG_OP='INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.negocios n WHERE n.id=NEW.negocio_id AND n.pipeline_lead_id=NEW.id AND n.fase='ganho' AND COALESCE(n.status,'ativo')='ativo') THEN RAISE EXCEPTION 'Confirme a venda com dados completos e anexos antes de mover para Ganho.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_guardar_etapa_venda_completa BEFORE INSERT OR UPDATE OF stage_id ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.guardar_etapa_venda_completa();

CREATE OR REPLACE FUNCTION public.venda_intermediacoes(p_lead_id uuid)
RETURNS TABLE(id uuid,comprador_nome text,empreendimento text,unidade text,vgv numeric,filename text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  RETURN QUERY SELECT i.id,i.comprador_nome,i.empreendimento,i.unidade,i.vgv,i.filename FROM public.intermediacoes i
    WHERE i.status='ativa' AND (i.pipeline_lead_id=p_lead_id OR i.negocio_id IN (SELECT n.id FROM public.negocios n WHERE n.pipeline_lead_id=p_lead_id AND n.status='ativo' AND n.fase<>'ganho'))
    ORDER BY i.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.venda_intermediacoes(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.venda_intermediacoes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_venda(p_lead_id uuid,p_empreendimento_id uuid,p_unidade text,p_vgv numeric,p_data date,p_intermediacao_id uuid,p_comprovante_path text,p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lead public.pipeline_leads; v_neg public.negocios; v_inter public.intermediacoes; v_emp public.empreendimentos_canonicos; v_corretor uuid; v_gerente uuid; v_result jsonb; v_stage uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.can_access_lead(p_lead_id)) THEN RAISE EXCEPTION 'Sem acesso a este cliente.'; END IF;
  SELECT * INTO v_neg FROM public.negocios WHERE pipeline_lead_id=p_lead_id AND status='ativo' AND (id=v_lead.negocio_id OR v_lead.negocio_id IS NULL) ORDER BY (id=v_lead.negocio_id) DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE;
  IF v_neg.id IS NOT NULL AND v_neg.fase='ganho' THEN RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',true); END IF;
  SELECT * INTO v_emp FROM public.empreendimentos_canonicos WHERE id=p_empreendimento_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um empreendimento oficial.'; END IF;
  SELECT * INTO v_inter FROM public.intermediacoes WHERE id=p_intermediacao_id FOR UPDATE;
  IF NOT FOUND OR v_inter.status<>'ativa' OR NOT (v_inter.pipeline_lead_id=p_lead_id OR (v_neg.id IS NOT NULL AND v_inter.negocio_id=v_neg.id)) THEN RAISE EXCEPTION 'Selecione uma intermediação deste cliente.'; END IF;
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
  v_result:=public.consolidar_lead_ganho(v_neg.id);
  IF NOT COALESCE((v_result->>'success')::boolean,false) THEN RAISE EXCEPTION 'Não foi possível consolidar o cliente como Ganho: %',v_result->>'reason'; END IF;
  SELECT stage_id INTO v_stage FROM public.pipeline_leads WHERE id=p_lead_id;
  INSERT INTO public.pipeline_historico(pipeline_lead_id,stage_anterior_id,stage_novo_id,movido_por,observacao) VALUES(p_lead_id,v_lead.stage_id,v_stage,auth.uid(),COALESCE(NULLIF(btrim(p_observacao),''),'Venda assinada com intermediação e comprovante do ato.'));
  INSERT INTO public.negocios_atividades(negocio_id,tipo,titulo,descricao,created_by) VALUES(v_neg.id,'venda_confirmada','Venda assinada',COALESCE(p_observacao,'Dados oficiais, intermediação e comprovante do ato conferidos.'),auth.uid());
  RETURN jsonb_build_object('negocio_id',v_neg.id,'ja_confirmada',false);
END $$;
REVOKE ALL ON FUNCTION public.confirmar_venda(uuid,uuid,text,numeric,date,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirmar_venda(uuid,uuid,text,numeric,date,uuid,text,text) TO authenticated;