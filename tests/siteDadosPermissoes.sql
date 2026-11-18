-- Dados sintéticos; isolamento e escrita protegida no papel real da API.
BEGIN;
DO $$
DECLARE p uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); dono uuid:=gen_random_uuid(); estranho uuid:=gen_random_uuid(); etapa uuid; n int; bloqueou boolean:=false;
BEGIN
 SELECT id INTO etapa FROM public.pipeline_stages WHERE ativo AND tipo='novo_lead' LIMIT 1;
 IF etapa IS NULL THEN RAISE EXCEPTION 'Sem etapa inicial'; END IF;
 INSERT INTO public.pipeline_leads(id,nome,stage_id,is_teste,arquivado,corretor_id,aceite_status,created_at,dados_site)
 VALUES(p,'TESTE CENTRAL permissão',etapa,true,true,dono,'aceito',now()-interval '2 days','{"jornada":{"numero_visitas":8}}');
 INSERT INTO public.leads(id,nome,telefone,origem,is_teste,status,pipeline_lead_id,dados_site)
 VALUES(l,'TESTE CENTRAL permissão cadastro','00000000000','site_uhome',true,'arquivado',p,'{"jornada":{"numero_visitas":8}}');
 PERFORM set_config('request.jwt.claim.sub',dono::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',dono,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.ler_dados_site_lead(p);
 IF n<>1 THEN RAISE EXCEPTION 'Dono não pode ler cartão'; END IF;
 SELECT count(*) INTO n FROM public.ler_dados_site_lead(l);
 IF n<>1 THEN RAISE EXCEPTION 'Dono não pode ler cadastro vinculado'; END IF;
 BEGIN UPDATE public.pipeline_leads SET dados_site='{"jornada":{"numero_visitas":999}}' WHERE id=p;
 EXCEPTION WHEN insufficient_privilege THEN bloqueou:=true; END;
 IF NOT bloqueou THEN RAISE EXCEPTION 'Dono conseguiu alterar jornada'; END IF;
 UPDATE public.pipeline_leads SET observacoes='Validação apenas, desfeita' WHERE id=p;
 PERFORM set_config('request.jwt.claim.sub',estranho::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',estranho,'role','authenticated')::text,true);
 SELECT count(*) INTO n FROM public.ler_dados_site_lead(p);
 IF n<>0 THEN RAISE EXCEPTION 'Outro corretor leu jornada'; END IF;
 SELECT count(*) INTO n FROM public.leads WHERE id=l;
 IF n<>0 THEN RAISE EXCEPTION 'Outro corretor leu cadastro'; END IF;
 EXECUTE 'SET LOCAL ROLE NONE';
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
 EXECUTE 'SET LOCAL ROLE anon';
 SELECT count(*) INTO n FROM public.pipeline_leads WHERE id=p;
 IF n<>0 THEN RAISE EXCEPTION 'Anon leu cartão'; END IF;
 SELECT count(*) INTO n FROM public.leads WHERE id=l;
 IF n<>0 THEN RAISE EXCEPTION 'Anon leu cadastro'; END IF;
 EXECUTE 'SET LOCAL ROLE NONE';
END $$;
ROLLBACK;