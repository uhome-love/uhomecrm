-- Somente dados sintéticos; nenhuma gravação persiste. Execute em transação.
BEGIN;
DO $$
DECLARE l uuid:=gen_random_uuid(); dono uuid:=gen_random_uuid(); stage uuid;
 p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); j jsonb; n int;
BEGIN
 SELECT id INTO stage FROM public.pipeline_stages WHERE tipo='novo_lead' AND ativo LIMIT 1;
 IF stage IS NULL THEN RAISE EXCEPTION 'Etapa de entrada não encontrada'; END IF;
 INSERT INTO public.pipeline_leads(id,nome,stage_id,is_teste,arquivado,corretor_id,aceite_status,created_at)
 VALUES(l,'TESTE CENTRAL regressão pedidos',stage,true,true,dono,'aceito',now()-interval '2 days');
 j:=jsonb_build_object('pedidos',jsonb_build_array(jsonb_build_object('id',p1,'tipo','visita','dia','2026-11-21','periodo','tarde','empreendimento','Open Bosque')));
 UPDATE public.pipeline_leads SET dados_site=j WHERE id=l;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=l AND site_pedido_id=p1)<>1 THEN RAISE EXCEPTION 'Primeiro pedido deve ter uma nota'; END IF;
 UPDATE public.pipeline_leads SET dados_site=j || '{"reenviado":true}'::jsonb WHERE id=l;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=l AND site_pedido_id=p1)<>1 THEN RAISE EXCEPTION 'Reenvio repetiu a nota'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE dados->>'lead_id'=l::text)<>1 THEN RAISE EXCEPTION 'Primeiro pedido deve gerar um aviso'; END IF;
 UPDATE public.pipeline_leads SET dados_site=j || jsonb_build_object('pedidos',(j->'pedidos') || jsonb_build_array(jsonb_build_object('id',p2,'tipo','informacoes','assunto','Valores e condições','empreendimento','Open Bosque'))) WHERE id=l;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=l AND site_pedido_id IS NOT NULL)<>2 THEN RAISE EXCEPTION 'Pedido novo não foi registrado'; END IF;
 IF (SELECT count(*) FROM public.notifications WHERE dados->>'lead_id'=l::text)<>1 THEN RAISE EXCEPTION 'Mais de um aviso na mesma hora'; END IF;
 IF EXISTS(SELECT 1 FROM public.notifications WHERE dados->>'lead_id'=l::text AND user_id<>dono) THEN RAISE EXCEPTION 'Aviso para outro usuário'; END IF;
 IF EXISTS(SELECT 1 FROM public.pipeline_leads WHERE id=l AND (stage_id<>stage OR corretor_id<>dono OR NOT arquivado)) THEN RAISE EXCEPTION 'Pedido mudou atendimento'; END IF;
 IF public.perf_atividade_humana((SELECT tipo FROM public.pipeline_atividades WHERE pipeline_lead_id=l LIMIT 1)) THEN RAISE EXCEPTION 'Pedido contado como contato humano'; END IF;
 IF public.site_pedido_texto('{"tipo":"visita","dia":"2026-11-21","periodo":"tarde","empreendimento":"Open Bosque"}') <> 'Pedido no site: visita · Open Bosque · sáb 21/11 tarde' THEN RAISE EXCEPTION 'Data BRT do pedido errada'; END IF;
 IF EXISTS(SELECT 1 FROM public.v_midia_lead_jornada WHERE lead_id=l) OR EXISTS(SELECT 1 FROM public.v_fato_lead WHERE lead_id=l) THEN RAISE EXCEPTION 'Teste em relatório'; END IF;
 -- Sem dono: grava pedido sem inventar uma atribuição ou notificação.
 UPDATE public.pipeline_leads SET corretor_id=NULL WHERE id=l;
 UPDATE public.pipeline_leads SET dados_site=jsonb_build_object('pedidos',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'tipo','whatsapp'))) WHERE id=l;
 IF (SELECT count(*) FROM public.notifications WHERE dados->>'lead_id'=l::text)<>1 THEN RAISE EXCEPTION 'Aviso sem dono'; END IF;
 IF (SELECT count(*) FROM public.pipeline_atividades WHERE pipeline_lead_id=l AND site_pedido_id IS NOT NULL)<>3 THEN RAISE EXCEPTION 'WhatsApp sem dono não registrado'; END IF;
END $$;
ROLLBACK;