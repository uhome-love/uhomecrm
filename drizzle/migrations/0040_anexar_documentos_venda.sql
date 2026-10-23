CREATE OR REPLACE FUNCTION public.anexar_documentos_venda(p_id uuid, p_intermediacao_id uuid DEFAULT NULL, p_comprovante_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_n public.negocios; v_i public.intermediacoes;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 SELECT * INTO v_n FROM public.negocios WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_n.fase<>'ganho' OR v_n.status<>'ativo' THEN RAISE EXCEPTION 'Escolha uma venda assinada ativa.'; END IF;
 IF p_intermediacao_id IS NULL AND NULLIF(btrim(p_comprovante_path),'') IS NULL THEN RAISE EXCEPTION 'Escolha a intermediação ou anexe o comprovante.'; END IF;
 IF p_intermediacao_id IS NOT NULL THEN
  IF v_n.intermediacao_id IS NOT NULL AND v_n.intermediacao_id<>p_intermediacao_id THEN RAISE EXCEPTION 'Esta venda já tem intermediação.'; END IF;
  SELECT * INTO v_i FROM public.intermediacoes WHERE id=p_intermediacao_id FOR UPDATE;
  IF NOT FOUND OR v_i.status NOT IN ('ativa','pendente_conferencia') THEN RAISE EXCEPTION 'Intermediação indisponível.'; END IF;
  IF v_i.negocio_id IS NOT NULL AND v_i.negocio_id<>v_n.id THEN RAISE EXCEPTION 'Intermediação já ligada a outra venda.'; END IF;
 END IF;
 IF NULLIF(btrim(p_comprovante_path),'') IS NOT NULL AND (v_n.comprovante_ato_path IS NOT NULL OR p_comprovante_path NOT LIKE 'negocio/'||v_n.id::text||'/%') THEN RAISE EXCEPTION 'Comprovante inválido ou já anexado.'; END IF;
 INSERT INTO public.financeiro_historico(entidade,entidade_id,acao,user_id,antes,depois)
 VALUES('negocios',v_n.id,'anexo_documentos',auth.uid(),jsonb_build_object('intermediacao_id',v_n.intermediacao_id,'comprovante_ato_path',v_n.comprovante_ato_path),jsonb_build_object('intermediacao_id',p_intermediacao_id,'comprovante_ato_path',p_comprovante_path));
 UPDATE public.negocios SET intermediacao_id=COALESCE(p_intermediacao_id,intermediacao_id), comprovante_ato_path=COALESCE(NULLIF(btrim(p_comprovante_path),''),comprovante_ato_path), updated_at=now() WHERE id=v_n.id;
 IF p_intermediacao_id IS NOT NULL THEN
  UPDATE public.intermediacoes SET negocio_id=v_n.id, pipeline_lead_id=COALESCE(pipeline_lead_id,v_n.pipeline_lead_id) WHERE id=p_intermediacao_id;
 END IF;
 RETURN v_n.id;
END $function$;
REVOKE ALL ON FUNCTION public.anexar_documentos_venda(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anexar_documentos_venda(uuid,uuid,text) TO authenticated;