DO $do$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.credenciar_por_alocacao(text)'::regprocedure);
  IF position('roleta_motivo_bloqueio' in d) > 0 THEN RETURN; END IF;
  n := replace(d,
    E'''Você está bloqueado para esta janela: leads vermelhos acima do limite ou excesso de descartes no mês. Atualize seu pipeline.'')',
    E'COALESCE(public.roleta_motivo_bloqueio(v_auth_user_id, p_janela)->>''texto'', ''Você está bloqueado para esta janela.''), ''motivo'', public.roleta_motivo_bloqueio(v_auth_user_id, p_janela))');
  IF n = d THEN RAISE EXCEPTION 'credenciar_por_alocacao: trecho da mensagem não encontrado'; END IF;
  EXECUTE n;
END $do$;