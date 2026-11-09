DO $fix$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='bolsao_elegiveis';
 definition:=replace(definition,'NOT EXISTS(SELECT 1 FROM bloqueados b WHERE b.chave=right(regexp_replace(pl.telefone,''[^0-9]'','''',''g''),8))','right(regexp_replace(pl.telefone,''[^0-9]'','''',''g''),8) NOT IN (SELECT b.chave FROM bloqueados b WHERE b.chave IS NOT NULL)');
 EXECUTE definition;
END
$fix$;