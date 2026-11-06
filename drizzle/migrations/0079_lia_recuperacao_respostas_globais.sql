-- Fase 2 aprovada: não ativa piloto, envio, cron de mensagens ou lotes.
ALTER TABLE public.meta_supressao ADD COLUMN IF NOT EXISTS canal_pedido text;
ALTER TABLE public.meta_supressao ADD COLUMN IF NOT EXISTS mensagem_pedido text;
ALTER TABLE public.meta_supressao ADD COLUMN IF NOT EXISTS pedido_em timestamptz;
ALTER TABLE public.meta_supressao ADD COLUMN IF NOT EXISTS retorno_cliente_em timestamptz;
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS recuperacao boolean NOT NULL DEFAULT false;
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS resposta_recuperacao_em timestamptz;
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS fila_ceo_em timestamptz;
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS reaviso_em timestamptz;
ALTER TABLE public.lia_estado ADD COLUMN IF NOT EXISTS reaviso_previsto_em timestamptz;
CREATE INDEX IF NOT EXISTS lia_estado_reaviso_idx ON public.lia_estado(reaviso_previsto_em) WHERE recuperacao AND reaviso_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS audit_recuperacao_evento_idx ON public.audit_log(request_id) WHERE modulo='lia_recuperacao' AND request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.contato_bloqueado(p_telefone text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT length(right(regexp_replace(coalesce(p_telefone,''),'[^0-9]','','g'),8))<>8 OR
 EXISTS(SELECT 1 FROM meta_supressao s WHERE s.telefone_last8=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (s.suprimir_ate IS NULL OR s.suprimir_ate>now())) OR
 EXISTS(SELECT 1 FROM base_leads b WHERE b.telefone_key=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND b.opt_out) OR
 EXISTS(SELECT 1 FROM lia_estado e WHERE right(regexp_replace(e.telefone,'[^0-9]','','g'),8)=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (e.optout OR e.status='ja_comprou')) OR
 EXISTS(SELECT 1 FROM ia_leads i WHERE i.telefone_last8=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND (i.opt_out OR i.etapa_motivo='ja_comprou')) OR
 EXISTS(SELECT 1 FROM pipeline_leads p WHERE right(regexp_replace(p.telefone,'[^0-9]','','g'),8)=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND p.motivo_descarte_code IN ('ja_comprou','comprou_outro','nao_quer_contato','lgpd'));
$$;
REVOKE ALL ON FUNCTION public.contato_bloqueado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contato_bloqueado(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.check_send_allowed(p_lead_id uuid,p_phone text,p_template text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.waba_send_guards; tel text:=p_phone;
BEGIN
 IF tel IS NULL THEN SELECT telefone INTO tel FROM pipeline_leads WHERE id=p_lead_id; END IF;
 IF public.contato_bloqueado(tel) THEN RETURN jsonb_build_object('allowed',false,'reason','contato_bloqueado'); END IF;
 SELECT * INTO g FROM waba_send_guards WHERE (lead_id=p_lead_id OR right(regexp_replace(phone_e164,'[^0-9]','','g'),8)=right(regexp_replace(tel,'[^0-9]','','g'),8)) AND (blocked_until IS NULL OR blocked_until>now()) AND (template_name IS NULL OR template_name=p_template) ORDER BY (template_name IS NOT NULL) DESC,blocked_at DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('allowed',false,'reason',g.reason,'guard_type',g.guard_type,'blocked_until',g.blocked_until); END IF;
 RETURN jsonb_build_object('allowed',true);
END $$;
REVOKE ALL ON FUNCTION public.check_send_allowed(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_send_allowed(uuid,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.registrar_resposta_recuperacao(p_telefone text,p_mensagem text,p_payload text DEFAULT NULL,p_evento text DEFAULT NULL,p_canal text DEFAULT 'whatsapp',p_novo_contato boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tel text:=right(regexp_replace(p_telefone,'[^0-9]','','g'),8); t text; b text; acao text:='seguir'; ids uuid[]; iaids uuid[]; e public.lia_estado; v_req text; anterior public.meta_supressao; v_ret boolean:=false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF length(tel)<>8 OR length(coalesce(p_mensagem,''))>10000 OR length(coalesce(p_payload,''))>300 OR length(coalesce(p_evento,''))>300 OR p_canal NOT IN ('whatsapp','anuncio','site','audio','atividade') THEN RAISE EXCEPTION 'Parâmetros inválidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('contato:'||tel));
 t:=lower(translate(coalesce(p_mensagem,''),'áàâãéêíóôõúç','aaaaeeiooouc'));
 b:=replace(replace(lower(coalesce(p_payload,'')),'_',' '),'-',' ');
 IF b ~ '^(lia )?(recupera )?(opt out|optout|stop|sair|nao quero mais contato)$' OR t ~ '(nao quero (mais )?(contato|receber|falar com voces)|nao me (mande|mandem|envie|enviem)|par[ae] de (me )?(mandar|enviar)|me (tira|tire|remove|remova) (da|dessa) lista|sair da lista|remover da lista|descadastr|me bloqueia)' OR trim(t)='stop' THEN acao:='opt_out';
 ELSIF t ~ '(ja (comprei|compramos|adquiri|adquirimos)|comprei (um |uma |o |a )?(imovel|apartamento|apto|casa))' AND t !~ '(nao|nunca) (comprei|compramos|adquiri)' THEN acao:='ja_comprou'; END IF;
 v_req:=CASE WHEN p_evento IS NOT NULL THEN p_canal||':'||p_evento||':'||acao END;
 IF v_req IS NOT NULL AND EXISTS(SELECT 1 FROM audit_log WHERE modulo='lia_recuperacao' AND request_id=v_req) THEN RETURN jsonb_build_object('acao',acao,'duplicada',true,'bloqueado',contato_bloqueado(p_telefone)); END IF;
 SELECT array_agg(id) INTO ids FROM pipeline_leads WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel;
 SELECT array_agg(id) INTO iaids FROM ia_leads WHERE telefone_last8=tel;
 SELECT * INTO anterior FROM meta_supressao WHERE telefone_last8=tel FOR UPDATE;
 -- Um anúncio/site novo deve ter um identificador externo novo, já deduplicado pelo chamador.
 IF p_novo_contato AND p_evento IS NOT NULL AND acao='seguir' THEN
   v_ret:=contato_bloqueado(p_telefone);
   UPDATE meta_supressao SET codigo='retorno_cliente',suprimir_ate=now(),retorno_cliente_em=now() WHERE telefone_last8=tel AND codigo IN ('opt_out_global','ja_comprou','opt_out');
   UPDATE base_leads SET opt_out=false,opt_out_motivo=NULL WHERE telefone_key=tel;
   UPDATE lia_estado SET optout=false,status='em_conversa',motivo=NULL,recuperacao=false,updated_at=now() WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel AND (optout OR status='ja_comprou');
   UPDATE ia_leads SET opt_out=false,opt_out_at=NULL,etapa='bloqueado',etapa_motivo='novo_contato_pipeline',pausado=true WHERE id=ANY(iaids) AND (opt_out OR etapa_motivo='ja_comprou');
   UPDATE pipeline_leads SET motivo_descarte_code=NULL,tipo_descarte='reengajavel',reengajamento_status=NULL,tags=array_remove(array_remove(tags,'opt_out_global'),'ja_comprou') WHERE id=ANY(ids) AND motivo_descarte_code IN ('ja_comprou','comprou_outro','nao_quer_contato','lgpd');
 END IF;
 -- Qualquer resposta cancela mensagens pendentes em todas as caixas; nunca tarefas humanas.
 UPDATE lia_followups SET status='cancelado',motivo='resposta_cliente',updated_at=now() WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel AND status IN ('pendente','aprovado','enviando');
 UPDATE ia_followups SET status='cancelado',cancelado_motivo='resposta_cliente' WHERE ia_lead_id=ANY(iaids) AND status IN ('pendente','aprovado','enviando');
 UPDATE lia_reengajamento_fila SET status=CASE WHEN status='pendente' THEN 'cancelado' ELSE status END,respondeu_em=coalesce(respondeu_em,now()),resposta_tipo=CASE WHEN acao='seguir' THEN 'humano' ELSE acao END,erro=CASE WHEN status='pendente' THEN 'resposta_cliente' ELSE erro END WHERE tel8=tel AND status IN ('pendente','enviado');
 UPDATE reengajamento_dispatch_queue SET status='cancelled',error_text='resposta_cliente',locked_at=NULL,locked_by=NULL WHERE phone_last8=tel AND status IN ('pending','processing');
 UPDATE lead_nurturing_sequences SET status='cancelado' WHERE pipeline_lead_id=ANY(ids) AND status IN ('pendente','agendado','enviando');
 UPDATE lead_nurturing_state SET status='cancelado',proximo_step_at=NULL,ultimo_evento='resposta_cliente',ultimo_evento_at=now() WHERE pipeline_lead_id=ANY(ids) AND status='ativo';
 UPDATE whatsapp_campaign_sends SET status_envio='cancelled' WHERE right(regexp_replace(telefone_normalizado,'[^0-9]','','g'),8)=tel AND status_envio IN ('pending','queued','processing','pendente');
 UPDATE lia_estado SET resposta_recuperacao_em=now(),last_user_at=now(),updated_at=now() WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel;
 IF acao<>'seguir' THEN
   INSERT INTO meta_supressao(telefone,telefone_last8,codigo,motivo,suprimir_ate,canal_pedido,mensagem_pedido,pedido_em) VALUES(p_telefone,tel,CASE WHEN acao='opt_out' THEN 'opt_out_global' ELSE 'ja_comprou' END,acao,NULL,p_canal,left(p_mensagem,2000),now()) ON CONFLICT(telefone_last8) DO UPDATE SET codigo=excluded.codigo,motivo=excluded.motivo,suprimir_ate=NULL,canal_pedido=excluded.canal_pedido,mensagem_pedido=excluded.mensagem_pedido,pedido_em=excluded.pedido_em,retorno_cliente_em=NULL;
   UPDATE base_leads SET opt_out=true,opt_out_motivo=acao WHERE telefone_key=tel;
   UPDATE ia_leads SET opt_out=true,opt_out_at=now(),pausado=true,etapa='desqualificado',etapa_motivo=acao WHERE id=ANY(iaids);
   INSERT INTO lia_estado(telefone,optout,status,motivo,resposta_recuperacao_em,last_user_at) VALUES(p_telefone,true,acao,acao,now(),now()) ON CONFLICT(telefone) DO UPDATE SET optout=true,status=excluded.status,motivo=excluded.motivo,resposta_recuperacao_em=now(),last_user_at=now();
   UPDATE lia_estado SET optout=true,status=acao,motivo=acao WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel;
   -- Preserve negócios ganhos: nenhuma compra declarada vira venda ou distrato.
   UPDATE pipeline_leads p SET arquivado=true,tipo_descarte='definitivo',motivo_descarte_code=CASE WHEN acao='opt_out' THEN 'nao_quer_contato' ELSE 'ja_comprou' END,motivo_descarte=CASE WHEN acao='opt_out' THEN 'Pedido de saída global' ELSE 'Cliente informou que já comprou' END,reengajamento_status='respondeu_nao',tags=array_append(coalesce(tags,ARRAY[]::text[]),CASE WHEN acao='opt_out' THEN 'opt_out_global' ELSE 'ja_comprou' END) WHERE id=ANY(ids) AND NOT EXISTS(SELECT 1 FROM negocios n WHERE n.pipeline_lead_id=p.id AND n.status='ganho');
   UPDATE oferta_ativa_leads SET status='descartado',motivo_descarte=acao,em_atendimento_por=NULL,em_atendimento_ate=NULL WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel OR base_lead_id IN (SELECT id FROM base_leads WHERE telefone_key=tel);
   UPDATE bolsao_reservas SET reservado_ate=NULL,ultimo_resultado='sem_interesse' WHERE pipeline_lead_id=ANY(ids);
   INSERT INTO pipeline_atividades(pipeline_lead_id,tipo,titulo,descricao,status,created_by) SELECT unnest(ids),'anotacao',CASE WHEN acao='opt_out' THEN 'Pedido de saída global' ELSE 'Cliente informou: já comprei' END,'Canal: '||p_canal||E'\nMensagem: '||left(coalesce(p_mensagem,p_payload,''),2000),'concluida','00000000-0000-0000-0000-000000000000'::uuid;
 END IF;
 INSERT INTO audit_log(user_id,modulo,acao,request_id,origem,descricao,depois) VALUES('00000000-0000-0000-0000-000000000000','lia_recuperacao',CASE WHEN v_ret THEN 'novo_contato_cliente' ELSE acao END,v_req,'webhook','Resposta do cliente: '||p_canal,jsonb_build_object('telefone_last8',tel,'canal',p_canal,'mensagem',left(p_mensagem,2000),'payload',p_payload,'data',now()));
 RETURN jsonb_build_object('acao',acao,'bloqueado',contato_bloqueado(p_telefone),'novo_contato',v_ret);
END $$;
REVOKE ALL ON FUNCTION public.registrar_resposta_recuperacao(text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_resposta_recuperacao(text,text,text,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.recuperacao_resposta_entrada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tel text; msg text; payload text; evento text;
BEGIN
 IF TG_TABLE_NAME='whatsapp_respostas' THEN
   tel:=NEW.phone;msg:=NEW.mensagem;payload:=coalesce(NEW.payload_raw#>>'{button,payload}',NEW.payload_raw#>>'{interactive,button_reply,id}');evento:=NEW.payload_raw->>'id';
 ELSIF TG_TABLE_NAME='whatsapp_mensagens' THEN
   IF NEW.direction NOT IN ('received','in') THEN RETURN NEW; END IF;
   SELECT telefone INTO tel FROM pipeline_leads WHERE id=NEW.lead_id;msg:=NEW.body;evento:=NEW.whatsapp_message_id;
 ELSIF TG_TABLE_NAME='ia_mensagens' THEN
   IF NEW.direcao<>'in' THEN RETURN NEW; END IF;
   SELECT telefone INTO tel FROM ia_leads WHERE id=NEW.ia_lead_id;msg:=NEW.conteudo;evento:=NEW.evolution_message_id;
 END IF;
 IF tel IS NOT NULL THEN PERFORM registrar_resposta_recuperacao(tel,coalesce(msg,''),payload,coalesce(evento,NEW.id::text),'whatsapp',false); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.recuperacao_resposta_entrada() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER recuperacao_whatsapp_resposta AFTER INSERT ON public.whatsapp_respostas FOR EACH ROW EXECUTE FUNCTION public.recuperacao_resposta_entrada();
CREATE TRIGGER recuperacao_whatsapp_mensagem AFTER INSERT ON public.whatsapp_mensagens FOR EACH ROW EXECUTE FUNCTION public.recuperacao_resposta_entrada();
CREATE TRIGGER recuperacao_ia_mensagem AFTER INSERT ON public.ia_mensagens FOR EACH ROW EXECUTE FUNCTION public.recuperacao_resposta_entrada();

-- Bloqueio de listas no servidor, inclusive clientes já reservados ou reimportados.
CREATE POLICY "Contato bloqueado fora das listas" ON public.oferta_ativa_leads AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.contato_bloqueado(telefone));
CREATE OR REPLACE FUNCTION public.recuperacao_oa_guarda() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.status IN ('na_fila','em_cooldown','em_atendimento') AND public.contato_bloqueado(NEW.telefone) THEN NEW.status:='descartado';NEW.motivo_descarte:='contato_bloqueado';NEW.em_atendimento_por:=NULL;NEW.em_atendimento_ate:=NULL; END IF;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.recuperacao_oa_guarda() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER recuperacao_oa_guarda BEFORE INSERT OR UPDATE ON public.oferta_ativa_leads FOR EACH ROW EXECUTE FUNCTION public.recuperacao_oa_guarda();

CREATE OR REPLACE FUNCTION public.lia_prazo_reaviso(p_entrada timestamptz) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE t timestamp:=p_entrada AT TIME ZONE 'America/Sao_Paulo';restante interval:=interval '30 minutes';passo interval;
BEGIN
 LOOP
 IF extract(dow FROM t)=0 OR t::time<'09:00' OR t::time>='20:00' THEN
   IF extract(dow FROM t)=0 OR t::time>='20:00' THEN t:=date_trunc('day',t)+interval '1 day 9 hours';ELSE t:=date_trunc('day',t)+interval '9 hours';END IF;CONTINUE;
 END IF;
 passo:=least(restante,date_trunc('day',t)+interval '20 hours'-t);t:=t+passo;restante:=restante-passo;
 IF restante<=interval '0' THEN RETURN t AT TIME ZONE 'America/Sao_Paulo';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.lia_prazo_reaviso(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lia_prazo_reaviso(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.lia_recuperar_para_fila_ceo(p_lead_id uuid,p_telefone text,p_nivel text,p_resumo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.pipeline_leads; e public.lia_estado; stage uuid; contexto text; destinatario uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_nivel NOT IN ('quente','morno','frio') OR length(coalesce(p_resumo,'')) NOT BETWEEN 1 AND 12000 THEN RAISE EXCEPTION 'Contexto inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('contato:'||right(regexp_replace(p_telefone,'[^0-9]','','g'),8)));
 SELECT * INTO p FROM pipeline_leads WHERE id=p_lead_id FOR UPDATE;
 IF p.id IS NULL OR right(regexp_replace(p.telefone,'[^0-9]','','g'),8)<>right(regexp_replace(p_telefone,'[^0-9]','','g'),8) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 IF public.contato_bloqueado(p_telefone) THEN RETURN jsonb_build_object('ok',false,'motivo','contato_bloqueado');END IF;
 SELECT * INTO e FROM lia_estado WHERE telefone=p_telefone FOR UPDATE;
 IF e.fila_ceo_em IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'lead_id',p.id,'ja_recuperado',true);END IF;
 IF NOT p.arquivado AND p.stage_id<>'1dd66c25-3848-4053-9f66-82e902989b4d'::uuid THEN RETURN jsonb_build_object('ok',false,'motivo','cliente_ativo');END IF;
 IF EXISTS(SELECT 1 FROM negocios WHERE pipeline_lead_id=p.id AND status='ganho') THEN RETURN jsonb_build_object('ok',false,'motivo','ja_comprou');END IF;
 SELECT id INTO stage FROM pipeline_stages WHERE tipo='novo_lead' AND ativo LIMIT 1;
 IF stage IS NULL THEN RAISE EXCEPTION 'Etapa indisponível';END IF;
 contexto:='Recuperado pela Lia'||E'\n'||p_resumo||E'\nDescarte anterior: '||coalesce(p.motivo_descarte,'sem motivo');
 UPDATE pipeline_leads SET arquivado=false,stage_id=stage,stage_changed_at=now(),corretor_id=NULL,aceite_status='pendente_distribuicao',motivo_pendencia='lia_recupera',reativado_em=now(),motivo_descarte=NULL,motivo_descarte_code=NULL,tipo_descarte=NULL,temperatura=p_nivel,prioridade_lead=CASE p_nivel WHEN 'quente' THEN 'alta' ELSE 'media' END,tags=coalesce(p.tags,ARRAY[]::text[])||ARRAY['lia_recupera','reengajado']||CASE WHEN p.corretor_id IS NOT NULL THEN ARRAY['descartado_por:'||p.corretor_id] ELSE ARRAY[]::text[] END,observacoes=concat_ws(E'\n\n',nullif(p.observacoes,''),contexto) WHERE id=p.id;
 INSERT INTO lia_estado(telefone,lead_id,recuperacao,status,nivel,resumo,fila_ceo_em,reaviso_previsto_em,repassado_em) VALUES(p_telefone,p.id,true,'qualificado',p_nivel,contexto,now(),lia_prazo_reaviso(now()),now()) ON CONFLICT(telefone) DO UPDATE SET lead_id=p.id,recuperacao=true,status='qualificado',nivel=p_nivel,resumo=contexto,fila_ceo_em=now(),reaviso_em=NULL,reaviso_previsto_em=lia_prazo_reaviso(now()),repassado_em=now();
 UPDATE lia_followups SET status='cancelado',motivo='fila_ceo' WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=right(regexp_replace(p_telefone,'[^0-9]','','g'),8) AND status IN ('pendente','aprovado');
 INSERT INTO pipeline_atividades(pipeline_lead_id,tipo,titulo,descricao,status,created_by) VALUES(p.id,'entrada','Recuperado pela Lia · Fila CEO para repasse manual',contexto,'concluida','00000000-0000-0000-0000-000000000000');
 FOR destinatario IN SELECT DISTINCT r.user_id FROM user_roles r JOIN profiles pr ON pr.user_id=r.user_id AND pr.ativo WHERE r.role IN ('admin','diretor') LOOP
  INSERT INTO notifications(user_id,tipo,categoria,titulo,mensagem,dados,agrupamento_key) VALUES(destinatario,'lead','lead_retorno','Recuperado pela Lia · '||p.nome,p.nome||' aguarda repasse manual na Fila CEO.',jsonb_build_object('pipeline_lead_id',p.id,'lead_nome',p.nome,'url','/pipeline-leads','resumo',contexto),'lia_recupera:'||p.id||':'||now()::text);
 END LOOP;
 RETURN jsonb_build_object('ok',true,'lead_id',p.id);
END $$;
REVOKE ALL ON FUNCTION public.lia_recuperar_para_fila_ceo(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lia_recuperar_para_fila_ceo(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.lia_reavisar_fila_ceo() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; destinatario uuid;n integer:=0;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão';END IF;
 IF extract(dow FROM now() AT TIME ZONE 'America/Sao_Paulo')=0 OR (now() AT TIME ZONE 'America/Sao_Paulo')::time<'09:00' OR (now() AT TIME ZONE 'America/Sao_Paulo')::time>='20:00' THEN RETURN 0;END IF;
 FOR e IN SELECT le.telefone,le.lead_id,le.fila_ceo_em,p.nome FROM lia_estado le JOIN pipeline_leads p ON p.id=le.lead_id WHERE le.recuperacao AND le.reaviso_em IS NULL AND le.reaviso_previsto_em<=now() AND p.corretor_id IS NULL AND NOT p.arquivado AND p.motivo_pendencia='lia_recupera' AND NOT public.contato_bloqueado(p.telefone) FOR UPDATE OF le SKIP LOCKED LOOP
  FOR destinatario IN SELECT DISTINCT r.user_id FROM user_roles r JOIN profiles pr ON pr.user_id=r.user_id AND pr.ativo WHERE r.role IN ('admin','diretor') LOOP
   INSERT INTO notifications(user_id,tipo,categoria,titulo,mensagem,dados,agrupamento_key) VALUES(destinatario,'lead','sla_urgente','Repasse pendente · '||e.nome,e.nome||' foi recuperado pela Lia e aguarda repasse há 30 minutos comerciais.',jsonb_build_object('pipeline_lead_id',e.lead_id,'lead_nome',e.nome,'url','/pipeline-leads'),'lia_recupera_reaviso:'||e.lead_id||':'||e.fila_ceo_em::text);
  END LOOP;
  UPDATE lia_estado SET reaviso_em=now() WHERE telefone=e.telefone;n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.lia_reavisar_fila_ceo() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lia_reavisar_fila_ceo() TO service_role;

CREATE OR REPLACE FUNCTION public.lia_recuperacao_repasse_guarda() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF 'lia_recupera'=ANY(coalesce(OLD.tags,ARRAY[]::text[])) AND NEW.corretor_id IS NOT NULL AND NEW.corretor_id IS DISTINCT FROM OLD.corretor_id THEN
   IF ('descartado_por:'||NEW.corretor_id)=ANY(OLD.tags) THEN RAISE EXCEPTION 'Esse corretor descartou o cliente e não pode recebê-lo de volta.';END IF;
   IF auth.role()='service_role' OR NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Recuperado pela Lia exige repasse manual da direção';END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lia_recuperacao_repasse_guarda() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lia_recuperacao_repasse_guarda BEFORE UPDATE ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.lia_recuperacao_repasse_guarda();

-- A reserva não contorna o bloqueio global nem respostas após programação, mesmo no legado.
CREATE OR REPLACE FUNCTION public.lia_reservar_envio(p_chave text,p_telefone text,p_origem text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb;v_dia date;h time;dow integer;usados integer;tel text;fonte public.pipeline_leads;f record;e public.lia_estado;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão';END IF;
 tel:=right(regexp_replace(p_telefone,'[^0-9]','','g'),8);
 IF length(tel)<>8 OR p_chave IS NULL OR length(p_chave)>200 OR p_origem NOT IN ('reengajamento','followup','proativo') THEN RETURN jsonb_build_object('permitido',false,'motivo','parametros_invalidos');END IF;
 PERFORM pg_advisory_xact_lock(hashtext('contato:'||tel));
 IF NOT (check_send_allowed(NULL,p_telefone,NULL)->>'allowed')::boolean THEN RETURN jsonb_build_object('permitido',false,'motivo','contato_bloqueado');END IF;
 SELECT * INTO e FROM lia_estado WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel ORDER BY updated_at DESC LIMIT 1;
 IF e.recuperacao AND e.resposta_recuperacao_em IS NOT NULL THEN RETURN jsonb_build_object('permitido',false,'motivo','resposta_cliente');END IF;
 SELECT * INTO f FROM lia_followups WHERE id::text=replace(p_chave,'followup:','');
 IF p_origem='followup' AND (f.id IS NULL OR f.status<>'aprovado' OR (e.last_user_at IS NOT NULL AND e.last_user_at>=f.created_at)) THEN RETURN jsonb_build_object('permitido',false,'motivo','resposta_cliente');END IF;
 SELECT lia_envio_programado INTO c FROM ia_config WHERE id=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('permitido',false,'motivo','config_indisponivel');END IF;
 IF c IS NULL THEN RETURN jsonb_build_object('permitido',true,'legado',true);END IF;
 PERFORM pg_advisory_xact_lock(hashtext('lia_envio_programado'));
 IF NOT(c ?& ARRAY['dias','inicio','fim','limite_dia','espera_horas']) OR jsonb_typeof(c->'dias')<>'array' OR (c->>'limite_dia')::integer NOT BETWEEN 1 AND 100 OR (c->>'espera_horas')::integer<24 THEN RETURN jsonb_build_object('permitido',false,'motivo','config_invalida');END IF;
 v_dia:=(now() AT TIME ZONE 'America/Sao_Paulo')::date;h:=(now() AT TIME ZONE 'America/Sao_Paulo')::time;dow:=extract(dow FROM now() AT TIME ZONE 'America/Sao_Paulo');
 IF NOT(c->'dias')@>to_jsonb(ARRAY[dow]) OR h<(c->>'inicio')::time OR h>=(c->>'fim')::time THEN RETURN jsonb_build_object('permitido',false,'motivo','fora_janela');END IF;
 IF p_origem='reengajamento' THEN SELECT p.* INTO fonte FROM lia_reengajamento_fila q JOIN pipeline_leads p ON p.id=q.pipeline_lead_id WHERE q.id::text=replace(p_chave,'reeng:','') AND q.status='pendente';
 ELSE SELECT p.* INTO fonte FROM lia_reengajamento_fila q JOIN pipeline_leads p ON p.id=q.pipeline_lead_id WHERE q.tel8=tel AND q.status='enviado' ORDER BY q.enviado_em DESC LIMIT 1;END IF;
 IF fonte.id IS NULL OR (fonte.stage_id<>'1dd66c25-3848-4053-9f66-82e902989b4d'::uuid AND NOT fonte.arquivado) THEN RETURN jsonb_build_object('permitido',false,'motivo','origem_descarte_nao_confirmada');END IF;
 IF fonte.tipo_descarte='definitivo' OR fonte.stage_changed_at IS NULL OR fonte.stage_changed_at>now()-make_interval(hours=>(c->>'espera_horas')::integer) THEN RETURN jsonb_build_object('permitido',false,'motivo','descarte_inelegivel');END IF;
 IF EXISTS(SELECT 1 FROM pipeline_leads p WHERE right(regexp_replace(p.telefone,'[^0-9]','','g'),8)=tel AND NOT p.arquivado AND p.stage_id<>'1dd66c25-3848-4053-9f66-82e902989b4d'::uuid) THEN RETURN jsonb_build_object('permitido',false,'motivo','cliente_ativo');END IF;
 IF EXISTS(SELECT 1 FROM lia_envio_reservas WHERE chave=p_chave) THEN RETURN jsonb_build_object('permitido',false,'motivo','ja_reservado');END IF;
 SELECT count(*) INTO usados FROM lia_envio_reservas WHERE dia=v_dia;
 IF usados>=(c->>'limite_dia')::integer THEN RETURN jsonb_build_object('permitido',false,'motivo','limite_dia');END IF;
 INSERT INTO lia_envio_reservas(dia,chave,telefone,origem) VALUES(v_dia,p_chave,tel,p_origem);
 RETURN jsonb_build_object('permitido',true,'legado',false);
END $$;
REVOKE ALL ON FUNCTION public.lia_reservar_envio(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lia_reservar_envio(text,text,text) TO service_role;

-- Preserve a régua do Bolsão e acrescente apenas o bloqueio de contato.
CREATE OR REPLACE FUNCTION public.bolsao_elegiveis(p_porta text) RETURNS TABLE(lead_id uuid,empreendimento_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT pl.id,coalesce(ec.nome,nullif(trim(pl.empreendimento),''),'Sem empreendimento') FROM pipeline_leads pl JOIN pipeline_stages s ON s.id=pl.stage_id LEFT JOIN empreendimentos_canonicos ec ON ec.id=pl.empreendimento_canonico_id
 WHERE NOT public.contato_bloqueado(pl.telefone) AND pl.negocio_id IS NULL AND coalesce(pl.modulo_atual,'')<>'pos_vendas'
 AND NOT EXISTS(SELECT 1 FROM visitas v WHERE v.pipeline_lead_id=pl.id) AND NOT EXISTS(SELECT 1 FROM negocios n WHERE n.pipeline_lead_id=pl.id) AND NOT EXISTS(SELECT 1 FROM pipeline_parcerias pp WHERE pp.pipeline_lead_id=pl.id AND pp.status='ativa')
 AND coalesce(pl.reengajamento_status,'') NOT IN ('respondeu_nao','respondeu_nao_wave2','respondido_nao','telefone_invalido','bloqueado','respondeu_sim','respondeu_sim_wave2','respondido_sim')
 AND NOT EXISTS(SELECT 1 FROM reengajamento_dispatch_queue q WHERE q.lead_id=pl.id AND q.status IN ('pending','processing'))
 AND (pl.empreendimento_canonico_id IS NULL OR NOT EXISTS(SELECT 1 FROM roleta_config rc WHERE rc.chave='fila_ceo_obrigatoria_canonicos' AND pl.empreendimento_canonico_id::text=ANY(string_to_array(replace(coalesce(rc.valor,''),' ',''),','))))
 AND NOT EXISTS(SELECT 1 FROM bolsao_reservas r WHERE r.pipeline_lead_id=pl.id AND ((r.reservado_ate>now() AND r.corretor_id IS DISTINCT FROM auth.uid()) OR r.cooldown_ate>now() OR r.ultimo_resultado IN ('sem_interesse')))
 AND ((p_porta='estagnados' AND pl.estagnado IS TRUE AND pl.estagnado_em<now()-interval '7 days' AND s.tipo NOT IN ('venda','caiu','descarte','convertido')) OR (p_porta='descartados' AND s.tipo='descarte' AND coalesce(pl.tipo_descarte,'reengajavel')='reengajavel' AND pl.stage_changed_at<now()-interval '7 days' AND pl.stage_changed_at>=now()-interval '180 days'));
$$;