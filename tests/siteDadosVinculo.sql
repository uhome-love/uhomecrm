-- Dados sintéticos, nunca usa ou altera clientes reais. Tudo é desfeito.
BEGIN;
DO $$
DECLARE l uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); dono uuid:=gen_random_uuid(); etapa uuid;
 pedido uuid:=gen_random_uuid(); outro uuid:=gen_random_uuid(); dados jsonb; anterior jsonb; r jsonb;
BEGIN
 SELECT id INTO etapa FROM public.pipeline_stages WHERE ativo AND tipo='novo_lead' LIMIT 1;
 IF etapa IS NULL THEN RAISE EXCEPTION 'Sem etapa inicial'; END IF;
 dados:=jsonb_build_object('jornada',jsonb_build_object('schema_version',1,'numero_visitas',8),
   'pedidos',jsonb_build_array(jsonb_build_object('id',pedido,'tipo','visita','dia','2026-11-21','periodo','tarde',
   'empreendimento','Open Bosque','horario','2026-11-18T00:36:00Z','financiamento','Ainda não sei')));
 INSERT INTO public.leads(id,nome,telefone,origem,is_teste,status,dados_site)
 VALUES(l,'TESTE CENTRAL vínculo','00000000000','site_uhome',true,'arquivado',dados);
 IF (SELECT pipeline_lead_id FROM public.leads WHERE id=l) IS NOT NULL THEN RAISE EXCEPTION 'Teste foi distribuído'; END IF;
 IF (SELECT count(*) FROM public.leads c CROSS JOIN LATERAL jsonb_object_keys(c.site_pedido_notas) k WHERE c.id=l)<>1 THEN RAISE EXCEPTION 'Cadastro sem cartão deve ter uma nota'; END IF;
 INSERT INTO public.pipeline_leads(id,nome,stage_id,is_teste,arquivado,corretor_id,aceite_status,created_at,dados_site)
 VALUES(p,'TESTE CENTRAL cartão',etapa,true,true,dono,'aceito',now()-interval '2 days','{"captacao":{"bairro":"Auxiliadora"}}');
 UPDATE public.leads SET pipeline_lead_id=p WHERE id=l;
 SELECT dados_site INTO r FROM public.pipeline_leads WHERE id=p;
 IF r->'jornada'->>'numero_visitas' IS DISTINCT FROM '8' OR r->'captacao'->>'bairro' IS DISTINCT FROM 'Auxiliadora' THEN RAISE EXCEPTION 'Vínculo perdeu dados'; END IF;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=p AND site_pedido_id=pedido)<>1 THEN RAISE EXCEPTION 'Nota não transferida'; END IF;
 UPDATE public.leads SET dados_site=dados || '{"pedido":{"id":"bad"}}'::jsonb WHERE id=l;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=p AND site_pedido_id=pedido)<>1 THEN RAISE EXCEPTION 'Nota repetida'; END IF;
 IF EXISTS(SELECT 1 FROM public.pipeline_leads WHERE id=p AND (corretor_id<>dono OR stage_id<>etapa OR NOT arquivado)) THEN RAISE EXCEPTION 'Vínculo mudou atendimento'; END IF;
 IF coalesce((SELECT descricao FROM public.pipeline_atividades WHERE pipeline_lead_id=p AND site_pedido_id=pedido),'') NOT LIKE '%17/11/2026 21:36%' THEN RAISE EXCEPTION 'Horário não convertido para BRT'; END IF;
 IF coalesce((SELECT descricao FROM public.pipeline_atividades WHERE pipeline_lead_id=p AND site_pedido_id=pedido),'') NOT LIKE '%Ainda não sei%' THEN RAISE EXCEPTION 'Financiamento perdido'; END IF;
 anterior:=jsonb_build_object('pedidos',jsonb_build_array(jsonb_build_object('id',pedido,'tipo','visita','financiamento','Ainda não sei','horario','2026-11-18T00:36:00Z')));
 r:=public.site_mesclar_dados(anterior,jsonb_build_object('pedidos',jsonb_build_array(jsonb_build_object('id',outro,'tipo','informacoes','horario','2026-11-19T00:36:00Z'))));
 IF jsonb_array_length(r->'pedidos') IS DISTINCT FROM 2 OR r->'pedido'->>'id' IS DISTINCT FROM outro::text THEN RAISE EXCEPTION 'Pedidos não mesclados'; END IF;
 r:=public.site_mesclar_dados(r,anterior);
 IF r->'pedido'->>'id' IS DISTINCT FROM outro::text THEN RAISE EXCEPTION 'Reenvio antigo substituiu último pedido'; END IF;
 IF EXISTS(SELECT 1 FROM public.v_midia_lead_jornada WHERE lead_id=p) THEN RAISE EXCEPTION 'Teste chegou na mídia'; END IF;
END $$;
ROLLBACK;