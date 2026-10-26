CREATE OR REPLACE FUNCTION public.validar_venda_completa(p_venda negocios)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  -- Unidade diferente da intermediação não bloqueia (imóvel avulso/revenda pode variar); fica registrada no histórico.
  IF lower(btrim(coalesce(v_inter.unidade,''))) IS DISTINCT FROM lower(btrim(p_venda.unidade))
     AND NOT EXISTS (SELECT 1 FROM public.negocios_atividades WHERE negocio_id=p_venda.id AND tipo='divergencia_unidade') THEN
    INSERT INTO public.negocios_atividades(negocio_id,tipo,titulo,descricao,created_by)
    VALUES(p_venda.id,'divergencia_unidade','Unidade diferente da intermediação','Venda: '||btrim(p_venda.unidade)||' · Intermediação: '||coalesce(nullif(btrim(v_inter.unidade),''),'—'),auth.uid());
  END IF;
  IF NULLIF(btrim(p_venda.comprovante_ato_path),'') IS NULL OR NOT (p_venda.comprovante_ato_path LIKE p_venda.id::text||'/%' OR p_venda.comprovante_ato_path LIKE 'lead/'||p_venda.pipeline_lead_id::text||'/%') THEN RAISE EXCEPTION 'Anexe o comprovante do ato deste cliente.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='vendas-docs' AND name=p_venda.comprovante_ato_path AND metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png','image/webp')) THEN RAISE EXCEPTION 'O comprovante do ato deve existir e ser PDF ou imagem.'; END IF;
END $function$;