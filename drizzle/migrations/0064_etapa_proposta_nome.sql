DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.homi_briefing_corretor(text,text,text)'::regprocedure);
  EXECUTE replace(d, $a$s.nome IN ('Em Negociação','Contrato')$a$, $a$s.nome IN ('Proposta','Em Negociação','Contrato')$a$);
  d := pg_get_functiondef('public.notify_visita_realizada_gerente()'::regprocedure);
  EXECUTE replace(d, 'evolui para Em Negociação ou regride', 'evolui para Documentação/Proposta ou regride');
  d := pg_get_functiondef('public.get_dashboard_gerente_v4_dia(uuid,text)'::regprocedure);
  EXECUTE replace(d, $a$('em_negociacao', 'Em Negociação', 1)$a$, $a$('em_negociacao', 'Em andamento', 1)$a$);
END $mig$;