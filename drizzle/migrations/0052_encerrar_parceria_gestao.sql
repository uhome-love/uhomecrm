CREATE OR REPLACE FUNCTION public.encerrar_parceria(p_parceria_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.pipeline_parcerias%ROWTYPE; v_uid uuid := auth.uid(); v_ok boolean; v_nome text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(p_motivo,''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO r FROM public.pipeline_parcerias WHERE id = p_parceria_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parceria não encontrada'; END IF;
  IF r.status <> 'ativa' THEN RAISE EXCEPTION 'Parceria já encerrada'; END IF;
  v_ok := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')
    OR (public.has_role(v_uid,'gestor') AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.gerente_id = v_uid AND tm.status = 'ativo'
        AND tm.user_id IN (r.corretor_principal_id, r.corretor_parceiro_id)));
  IF NOT v_ok THEN RAISE EXCEPTION 'Sem permissão para desfazer esta parceria'; END IF;
  SELECT nome INTO v_nome FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  UPDATE public.pipeline_parcerias
     SET status='encerrada', encerrada_em=now(), updated_at=now(),
         motivo = COALESCE(motivo || ' | ', '') || 'Desfeita por ' || coalesce(v_nome,'gestão') || ': ' || trim(p_motivo)
   WHERE id = p_parceria_id;
  INSERT INTO public.pipeline_anotacoes (pipeline_lead_id, conteudo, autor_id, autor_nome)
  VALUES (r.pipeline_lead_id, 'Parceria desfeita pela gestão. Motivo: ' || trim(p_motivo), v_uid, coalesce(v_nome,'Gestão'));
  INSERT INTO public.audit_log (user_id, modulo, acao, antes, depois, origem, descricao)
  VALUES (v_uid, 'pipeline_parcerias', 'encerrar_parceria', to_jsonb(r),
          jsonb_build_object('status','encerrada','motivo',trim(p_motivo)), 'rpc', 'Parceria desfeita pela gestão');
END $$;
REVOKE ALL ON FUNCTION public.encerrar_parceria(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_parceria(uuid, text) TO authenticated;