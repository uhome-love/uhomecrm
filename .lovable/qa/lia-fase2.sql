-- Run in a privileged QA session. No client messages; all writes roll back.
BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$
DECLARE v_id uuid:='f2000000-0000-4000-8000-000000000087'; v_tel text:='5500000000087'; r jsonb;
BEGIN
 INSERT INTO public.pipeline_leads(id,nome,telefone,stage_id,arquivado,aceite_status,tipo_descarte,stage_changed_at)
 VALUES(v_id,'TESTE FASE 2 LIA',v_tel,'1dd66c25-3848-4053-9f66-82e902989b4d',true,'descartado','reengajavel',now()-interval '40 days');
 INSERT INTO public.lia_estado(telefone,lead_id,recuperacao) VALUES(v_tel,v_id,true);
 INSERT INTO public.lia_followups(telefone,lead_id,status,mensagem,motivo) VALUES(v_tel,v_id,'aprovado','Lembrete fictício','Teste sem envio');
 r:=public.registrar_resposta_recuperacao(v_tel,'Sim, quero visitar',null,'qa-fase2-resposta','whatsapp',false);
 IF r->>'acao'<>'seguir' OR EXISTS(SELECT 1 FROM public.lia_followups WHERE telefone=v_tel AND status='aprovado') THEN RAISE EXCEPTION 'Resposta não cancelou lembrete'; END IF;
 r:=public.lia_recuperar_para_fila_ceo(v_id,v_tel,'quente','Cliente prefere sábado pela manhã; equipe confirma horário.');
 IF NOT(r->>'ok')::boolean OR NOT EXISTS(SELECT 1 FROM public.pipeline_leads WHERE id=v_id AND corretor_id IS NULL AND aceite_status='pendente_distribuicao' AND motivo_pendencia='lia_recupera' AND NOT arquivado) THEN RAISE EXCEPTION 'Fila CEO incorreta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE dados->>'pipeline_lead_id'=v_id::text AND titulo LIKE 'Recuperado pela Lia%') THEN RAISE EXCEPTION 'Aviso ausente'; END IF;
 r:=public.registrar_resposta_recuperacao(v_tel,'','lia_recupera_opt_out','qa-fase2-optout','whatsapp',false);
 IF r->>'acao'<>'opt_out' OR (public.check_send_allowed(v_id,v_tel,'lia_recupera_a')->>'allowed')::boolean THEN RAISE EXCEPTION 'Saída não bloqueou'; END IF;
 r:=public.registrar_resposta_recuperacao(v_tel,'Novo pedido',null,'qa-fase2-retorno','anuncio',true);
 IF (r->>'bloqueado')::boolean THEN RAISE EXCEPTION 'Novo pedido não reabriu'; END IF;
 r:=public.registrar_resposta_recuperacao(v_tel,'Já comprei com outra imobiliária',null,'qa-fase2-compra','whatsapp',false);
 IF r->>'acao'<>'ja_comprou' OR NOT(r->>'bloqueado')::boolean THEN RAISE EXCEPTION 'Compra não bloqueou'; END IF;
 IF (public.lia_reservar_envio('qa:87',v_tel,'followup')->>'permitido')::boolean THEN RAISE EXCEPTION 'Compra autorizou envio'; END IF;
END $$;
ROLLBACK;