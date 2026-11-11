DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE proname='registrar_resposta_recuperacao';
  IF position('supressao_tecnica_limpa' in d)=0 THEN
    d:=replace(d,' -- Qualquer resposta cancela mensagens pendentes',
      ' -- supressao_tecnica_limpa: resposta do cliente prova que o número existe; só saída/já comprou seguem bloqueando.
 IF acao=''seguir'' THEN DELETE FROM meta_supressao WHERE telefone_last8=tel AND coalesce(codigo,'''') IN (''undeliverable'',''throttle_131049'',''experiment_130472'',''''); END IF;
 -- Qualquer resposta cancela mensagens pendentes');
    EXECUTE d;
  END IF;
END $do$;
DELETE FROM public.meta_supressao WHERE telefone_last8='92597097' AND codigo='undeliverable';