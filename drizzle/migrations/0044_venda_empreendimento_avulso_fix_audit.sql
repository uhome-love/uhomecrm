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
  SELECT id INTO v_id FROM public.empreendimentos_canonicos WHERE lower(public.unaccent(nome)) = lower(public.unaccent(v_nome)) LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.empreendimentos_canonicos SET construtora = coalesce(NULLIF(btrim(construtora),''), v_cons) WHERE id=v_id;
    RETURN v_id;
  END IF;
  INSERT INTO public.empreendimentos_canonicos(nome, construtora, ativo, origem, created_by, ordem)
  VALUES (v_nome, v_cons, false, 'venda', auth.uid(), 9999) RETURNING id INTO v_id;
  INSERT INTO public.audit_log(user_id, acao, modulo, descricao, depois)
  VALUES (auth.uid(), 'criar_empreendimento_venda', 'vendas', 'Empreendimento criado no registro de venda', jsonb_build_object('id',v_id,'nome',v_nome,'construtora',v_cons,'tipo',p_tipo));
  RETURN v_id;
END $$;