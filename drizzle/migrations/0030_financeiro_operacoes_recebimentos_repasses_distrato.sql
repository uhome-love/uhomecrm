CREATE TABLE public.financeiro_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entidade text NOT NULL, entidade_id uuid NOT NULL, acao text NOT NULL, user_id uuid, antes jsonb, depois jsonb, transacao bigint NOT NULL DEFAULT txid_current(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financeiro_historico TO authenticated;
GRANT ALL ON public.financeiro_historico TO service_role;
ALTER TABLE public.financeiro_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY financeiro_historico_leitura ON public.financeiro_historico FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));
CREATE INDEX financeiro_historico_entidade ON public.financeiro_historico(entidade_id,created_at DESC);
CREATE TABLE public.financeiro_repasses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recebimento_id uuid NOT NULL REFERENCES public.negocios_recebimentos(id), beneficiario_id uuid NOT NULL REFERENCES public.intermediacao_beneficiarios(id), valor numeric NOT NULL, pago_em date NOT NULL, comprovante_path text NOT NULL, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(recebimento_id,beneficiario_id)
);
GRANT SELECT ON public.financeiro_repasses TO authenticated;
GRANT ALL ON public.financeiro_repasses TO service_role;
ALTER TABLE public.financeiro_repasses ENABLE ROW LEVEL SECURITY;
CREATE POLICY financeiro_repasses_leitura ON public.financeiro_repasses FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE OR REPLACE FUNCTION public.financeiro_exigir_acesso() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Financeiro é exclusivo do CEO ou diretora.'; END IF; END $$;
REVOKE ALL ON FUNCTION public.financeiro_exigir_acesso() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_validar_comprovante(p_path text,p_negocio uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_path IS NULL OR p_path NOT LIKE p_negocio::text||'/financeiro/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='vendas-docs' AND name=p_path AND metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png','image/webp')) THEN RAISE EXCEPTION 'Anexe um comprovante PDF ou imagem desta venda.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_validar_comprovante(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_auditar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
 INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois) VALUES(TG_TABLE_NAME,COALESCE(NEW.id,OLD.id),lower(TG_OP),auth.uid(),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER financeiro_recebimentos_audit AFTER INSERT OR UPDATE OR DELETE ON public.negocios_recebimentos FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar();
CREATE TRIGGER financeiro_repasses_audit AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_repasses FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar();
CREATE TRIGGER financeiro_custos_audit AFTER INSERT OR UPDATE OR DELETE ON public.custos_fixos FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar();
CREATE TRIGGER financeiro_midia_audit AFTER INSERT OR UPDATE OR DELETE ON public.custos_midia_manual FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar();

CREATE OR REPLACE FUNCTION public.financeiro_salvar_parcela(p_intermediacao uuid,p_id uuid,p_valor numeric,p_vencimento date,p_forma text,p_observacao text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_i public.intermediacoes; v_r public.negocios_recebimentos; v_total numeric; v_id uuid;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_i FROM public.intermediacoes WHERE id=p_intermediacao AND status='ativa' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.negocios WHERE id=v_i.negocio_id AND fase='ganho' AND status='ativo') THEN RAISE EXCEPTION 'Escolha uma intermediação ativa de uma venda assinada.'; END IF;
 IF p_valor IS NULL OR p_valor<=0 OR p_valor::text IN ('NaN','Infinity','-Infinity') OR p_vencimento IS NULL OR p_forma NOT IN ('pix','zemo','nota_fiscal') OR p_forma IS NULL THEN RAISE EXCEPTION 'Informe valor positivo, vencimento e forma de pagamento.'; END IF;
 IF v_i.forma_pagamento IS NULL OR p_forma IS DISTINCT FROM v_i.forma_pagamento THEN RAISE EXCEPTION 'A forma deve ser a mesma escolhida na intermediação. Confira o documento.'; END IF;
 IF p_id IS NOT NULL THEN SELECT * INTO v_r FROM public.negocios_recebimentos WHERE id=p_id AND intermediacao_id=p_intermediacao FOR UPDATE; IF NOT FOUND OR v_r.status<>'pendente' THEN RAISE EXCEPTION 'Somente parcelas pendentes podem ser editadas.'; END IF; END IF;
 SELECT COALESCE(sum(valor),0) INTO v_total FROM public.negocios_recebimentos WHERE intermediacao_id=p_intermediacao AND status<>'cancelado' AND (p_id IS NULL OR id<>p_id);
 IF v_total+p_valor>COALESCE(v_i.valor_bruto,v_i.valor_comissao)+0.01 THEN RAISE EXCEPTION 'As parcelas não podem ultrapassar a comissão bruta da intermediação.'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.negocios_recebimentos(negocio_id,intermediacao_id,parcela_num,vencimento,valor,forma,observacao,created_by) VALUES(v_i.negocio_id,v_i.id,(SELECT COALESCE(max(parcela_num),0)+1 FROM public.negocios_recebimentos WHERE intermediacao_id=v_i.id),p_vencimento,round(p_valor,2),p_forma,NULLIF(btrim(p_observacao),''),auth.uid()) RETURNING id INTO v_id;
 ELSE UPDATE public.negocios_recebimentos SET valor=round(p_valor,2),vencimento=p_vencimento,forma=p_forma,observacao=NULLIF(btrim(p_observacao),''),updated_at=now() WHERE id=p_id RETURNING id INTO v_id; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_salvar_parcela(uuid,uuid,numeric,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.financeiro_salvar_parcela(uuid,uuid,numeric,date,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_receber_parcela(p_id uuid,p_data date,p_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_r public.negocios_recebimentos;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_r FROM public.negocios_recebimentos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.intermediacoes i JOIN public.negocios n ON n.id=i.negocio_id WHERE i.id=v_r.intermediacao_id AND i.status='ativa' AND n.fase='ganho' AND n.status='ativo') THEN RAISE EXCEPTION 'Parcela não pertence a uma venda ativa.'; END IF;
 IF v_r.status='recebido' THEN RETURN v_r.id; END IF;
 IF v_r.status<>'pendente' THEN RAISE EXCEPTION 'Esta parcela não está pendente.'; END IF;
 IF p_data IS NULL OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe a data real do recebimento, sem data futura.'; END IF;
 IF v_r.forma IS NULL OR v_r.forma NOT IN ('pix','zemo','nota_fiscal') THEN RAISE EXCEPTION 'Confira a forma de pagamento antes de receber.'; END IF;
 PERFORM public.financeiro_validar_comprovante(p_path,v_r.negocio_id);
 UPDATE public.negocios_recebimentos SET status='recebido',recebido_em=p_data,comprovante_path=p_path,updated_at=now() WHERE id=p_id;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_receber_parcela(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.financeiro_receber_parcela(uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_registrar_repasse(p_recebimento uuid,p_beneficiario uuid,p_data date,p_path text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_r public.negocios_recebimentos; v_b public.intermediacao_beneficiarios; v_i public.intermediacoes; v_valor numeric; v_id uuid;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_r FROM public.negocios_recebimentos WHERE id=p_recebimento FOR UPDATE;
 SELECT * INTO v_i FROM public.intermediacoes WHERE id=v_r.intermediacao_id AND status='ativa';
 SELECT * INTO v_b FROM public.intermediacao_beneficiarios WHERE id=p_beneficiario AND intermediacao_id=v_i.id;
 IF v_r.id IS NULL OR v_r.status<>'recebido' OR v_i.id IS NULL OR v_i.forma_pagamento<>'nota_fiscal' OR v_b.id IS NULL OR v_b.papel='uhome' OR NOT EXISTS(SELECT 1 FROM public.negocios WHERE id=v_r.negocio_id AND fase='ganho' AND status='ativo') THEN RAISE EXCEPTION 'Repasse exige parcela de Nota fiscal recebida e beneficiário desta intermediação.'; END IF;
 IF p_data IS NULL OR p_data<v_r.recebido_em OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'A data do repasse deve ficar entre o recebimento e hoje.'; END IF;
 PERFORM public.financeiro_validar_comprovante(p_path,v_r.negocio_id);
 v_valor:=round(v_b.valor_liquido*v_r.valor/NULLIF(COALESCE(v_i.valor_bruto,v_i.valor_comissao),0),2);
 IF v_valor IS NULL OR v_valor<=0 THEN RAISE EXCEPTION 'A divisão da intermediação precisa ser conferida.'; END IF;
 INSERT INTO public.financeiro_repasses(recebimento_id,beneficiario_id,valor,pago_em,comprovante_path,created_by) VALUES(v_r.id,v_b.id,v_valor,p_data,p_path,auth.uid()) ON CONFLICT(recebimento_id,beneficiario_id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.financeiro_repasses WHERE recebimento_id=v_r.id AND beneficiario_id=v_b.id; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_registrar_repasse(uuid,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.financeiro_registrar_repasse(uuid,uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardar_venda_assinada() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_nova boolean; v_distrato boolean:=false;
BEGIN
 IF TG_OP='DELETE' THEN IF OLD.fase='ganho' AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Venda assinada não pode ser excluída. Distrato somente no Financeiro pelo CEO ou diretora.'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.fase='ganho' AND COALESCE(OLD.status,'ativo')='ativo' AND (NEW.fase IS DISTINCT FROM OLD.fase OR NEW.status IS DISTINCT FROM OLD.status OR NEW.distrato_em IS DISTINCT FROM OLD.distrato_em OR NEW.distrato_motivo IS DISTINCT FROM OLD.distrato_motivo OR NEW.distrato_por IS DISTINCT FROM OLD.distrato_por) AND auth.uid() IS NOT NULL THEN
  v_distrato:=(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')) AND NEW.fase='ganho' AND NEW.status='distratado' AND EXISTS(SELECT 1 FROM public.financeiro_historico h WHERE h.entidade='negocios' AND h.entidade_id=OLD.id AND h.acao='distrato' AND h.user_id=auth.uid() AND h.transacao=txid_current() AND h.depois->>'distrato_em'=NEW.distrato_em::text AND h.depois->>'distrato_motivo'=NEW.distrato_motivo);
  IF NOT v_distrato THEN RAISE EXCEPTION 'Distrato somente no Financeiro pelo CEO ou diretora.'; END IF;
 END IF;
 v_nova:=NEW.fase='ganho';
 IF TG_OP='UPDATE' THEN v_nova:=NEW.fase='ganho' AND (OLD.fase IS DISTINCT FROM 'ganho' OR (COALESCE(NEW.status,'ativo')='ativo' AND COALESCE(OLD.status,'ativo')<>'ativo')); END IF;
 IF v_nova THEN PERFORM public.validar_venda_completa(NEW); END IF;
 IF TG_OP='UPDATE' AND OLD.fase='ganho' AND auth.uid() IS NOT NULL THEN IF (OLD.comprovante_ato_path IS NOT NULL AND NEW.comprovante_ato_path IS DISTINCT FROM OLD.comprovante_ato_path) OR (OLD.intermediacao_id IS NOT NULL AND NEW.intermediacao_id IS DISTINCT FROM OLD.intermediacao_id) THEN RAISE EXCEPTION 'Os anexos da venda assinada devem ser preservados.'; END IF; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_distrato(p_negocio uuid,p_data date,p_motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_n public.negocios;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_n FROM public.negocios WHERE id=p_negocio FOR UPDATE;
 IF NOT FOUND OR v_n.fase<>'ganho' THEN RAISE EXCEPTION 'Escolha uma venda assinada.'; END IF;
 IF v_n.status='distratado' THEN RETURN v_n.id; END IF;
 IF v_n.status<>'ativo' THEN RAISE EXCEPTION 'Venda não está ativa.'; END IF;
 IF p_data IS NULL OR p_data<v_n.data_assinatura OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR length(btrim(COALESCE(p_motivo,'')))<10 THEN RAISE EXCEPTION 'Informe a data real do distrato e o motivo com pelo menos 10 caracteres.'; END IF;
 INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois) VALUES('negocios',v_n.id,'distrato',auth.uid(),to_jsonb(v_n),jsonb_build_object('distrato_em',p_data,'distrato_motivo',btrim(p_motivo),'distrato_por',auth.uid()));
 UPDATE public.negocios SET status='distratado',distrato_em=p_data,distrato_motivo=btrim(p_motivo),distrato_por=auth.uid(),updated_at=now() WHERE id=v_n.id;
 UPDATE public.negocios_recebimentos SET status='cancelado',observacao=concat_ws(' | ',observacao,'Cancelada por distrato'),updated_at=now() WHERE negocio_id=v_n.id AND status='pendente';
 RETURN v_n.id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_distrato(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_distrato(uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_validar_recebimento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status NOT IN ('pendente','recebido','cancelado') OR NEW.valor<=0 OR NEW.valor::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Parcela inválida.'; END IF;
 IF NEW.status='recebido' THEN
  IF NEW.recebido_em IS NULL OR NEW.recebido_em>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Informe a data real do recebimento.'; END IF;
  PERFORM public.financeiro_validar_comprovante(NEW.comprovante_path,NEW.negocio_id);
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='recebido' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.valor IS DISTINCT FROM OLD.valor OR NEW.recebido_em IS DISTINCT FROM OLD.recebido_em OR NEW.comprovante_path IS DISTINCT FROM OLD.comprovante_path OR NEW.intermediacao_id IS DISTINCT FROM OLD.intermediacao_id) THEN RAISE EXCEPTION 'Recebimentos confirmados são preservados no histórico.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER financeiro_recebimento_validar BEFORE INSERT OR UPDATE ON public.negocios_recebimentos FOR EACH ROW EXECUTE FUNCTION public.financeiro_validar_recebimento();

CREATE OR REPLACE FUNCTION public.financeiro_auditar_venda() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.fase='ganho' AND (NEW.vgv_final IS DISTINCT FROM OLD.vgv_final OR NEW.unidade IS DISTINCT FROM OLD.unidade OR NEW.data_assinatura IS DISTINCT FROM OLD.data_assinatura) THEN INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois) VALUES('negocios',NEW.id,'edicao_venda',auth.uid(),to_jsonb(OLD),to_jsonb(NEW)); END IF; RETURN NEW;
END $$;
CREATE TRIGGER financeiro_venda_audit AFTER UPDATE ON public.negocios FOR EACH ROW EXECUTE FUNCTION public.financeiro_auditar_venda();