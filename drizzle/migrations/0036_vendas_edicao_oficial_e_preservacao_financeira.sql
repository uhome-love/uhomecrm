CREATE OR REPLACE FUNCTION public.editar_venda(p_id uuid,p_nome text,p_empreendimento uuid,p_unidade text,p_vgv numeric,p_data date,p_observacoes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_n public.negocios; v_e public.empreendimentos_canonicos;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_n FROM public.negocios WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_n.fase<>'ganho' OR v_n.status<>'ativo' THEN RAISE EXCEPTION 'Escolha uma venda assinada ativa.'; END IF;
 SELECT * INTO v_e FROM public.empreendimentos_canonicos WHERE id=p_empreendimento;
 IF NOT FOUND OR NULLIF(btrim(v_e.construtora),'') IS NULL THEN RAISE EXCEPTION 'Selecione o empreendimento oficial com construtora.'; END IF;
 IF NULLIF(btrim(p_nome),'') IS NULL OR NULLIF(btrim(p_unidade),'') IS NULL OR p_vgv IS NULL OR p_vgv<=0 OR p_vgv::text IN('NaN','Infinity','-Infinity') OR p_vgv<>round(p_vgv,2) OR p_data IS NULL OR p_data>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Preencha cliente, unidade, VGV e data real de assinatura.'; END IF;
 INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois) VALUES('negocios',v_n.id,'edicao_venda',auth.uid(),to_jsonb(v_n),jsonb_build_object('nome_cliente',btrim(p_nome),'empreendimento_canonico_id',v_e.id,'unidade',btrim(p_unidade),'vgv_final',p_vgv,'data_assinatura',p_data,'observacoes',p_observacoes));
 UPDATE public.negocios SET nome_cliente=btrim(p_nome),empreendimento_canonico_id=v_e.id,empreendimento=v_e.nome,construtora=v_e.construtora,unidade=btrim(p_unidade),vgv_final=p_vgv,data_assinatura=p_data,observacoes=NULLIF(btrim(p_observacoes),''),updated_at=now() WHERE id=v_n.id;
 RETURN v_n.id;
END $$;
REVOKE ALL ON FUNCTION public.editar_venda(uuid,text,uuid,text,numeric,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.editar_venda(uuid,text,uuid,text,numeric,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.venda_edicao_oficial_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR OLD.fase<>'ganho' THEN RETURN NEW; END IF;
 IF (NEW.nome_cliente,NEW.empreendimento,NEW.empreendimento_canonico_id,NEW.construtora,NEW.unidade,NEW.vgv_final,NEW.data_assinatura) IS DISTINCT FROM (OLD.nome_cliente,OLD.empreendimento,OLD.empreendimento_canonico_id,OLD.construtora,OLD.unidade,OLD.vgv_final,OLD.data_assinatura) THEN
  IF NOT EXISTS(SELECT 1 FROM public.financeiro_historico WHERE entidade='negocios' AND entidade_id=OLD.id AND acao='edicao_venda' AND user_id=auth.uid() AND transacao=txid_current()) THEN RAISE EXCEPTION 'Edite a venda pela página Vendas com o CEO ou diretora.'; END IF;
 END IF;
 IF OLD.status='distratado' AND (NEW.status,NEW.fase,NEW.distrato_em,NEW.distrato_motivo,NEW.distrato_por) IS DISTINCT FROM (OLD.status,OLD.fase,OLD.distrato_em,OLD.distrato_motivo,OLD.distrato_por) THEN RAISE EXCEPTION 'Preserve o distrato registrado no Financeiro.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER venda_edicao_oficial BEFORE UPDATE ON public.negocios FOR EACH ROW EXECUTE FUNCTION public.venda_edicao_oficial_guard();
CREATE OR REPLACE FUNCTION public.intermediacao_edicao_preservar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.negocios WHERE intermediacao_id=OLD.id AND fase='ganho') OR OLD.origem='drive_historico' OR EXISTS(SELECT 1 FROM public.negocios_recebimentos WHERE intermediacao_id=OLD.id AND status='recebido') THEN
  IF to_jsonb(NEW)-'updated_at' IS DISTINCT FROM to_jsonb(OLD)-'updated_at' THEN RAISE EXCEPTION 'Preserve a intermediação assinada, histórica ou recebida.'; END IF;
 ELSE
  IF to_jsonb(NEW)-ARRAY['status','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['status','updated_at'] THEN RAISE EXCEPTION 'Gere uma nova versão completa para alterar a intermediação.'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER intermediacao_edicao_guard BEFORE UPDATE ON public.intermediacoes FOR EACH ROW EXECUTE FUNCTION public.intermediacao_edicao_preservar();