ALTER TABLE public.ia_config ADD COLUMN lia_envio_programado jsonb;
ALTER TABLE public.lia_laboratorio_execucoes ADD COLUMN ficha_versao timestamptz, ADD COLUMN ficha_hash text;
CREATE TABLE public.lia_envio_reservas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dia date NOT NULL, chave text NOT NULL UNIQUE, telefone text NOT NULL, origem text NOT NULL, status text NOT NULL DEFAULT 'reservado', criado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.lia_envio_reservas TO authenticated;
GRANT ALL ON public.lia_envio_reservas TO service_role;
ALTER TABLE public.lia_envio_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lia_reservas_admin ON public.lia_envio_reservas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.lia_salvar_ficha(p_id uuid,p_versao timestamptz,p_ficha text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.lia_produtos; n public.lia_produtos;
BEGIN
 IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO v FROM lia_produtos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v.slug LIKE '%__backup%' THEN RAISE EXCEPTION 'Ficha indisponível para edição'; END IF;
 IF v.updated_at IS DISTINCT FROM p_versao THEN RAISE EXCEPTION 'A ficha mudou. Atualize a página antes de salvar.'; END IF;
 IF length(trim(p_ficha))=0 OR length(p_ficha)>100000 THEN RAISE EXCEPTION 'Ficha inválida'; END IF;
 IF v.ficha IS DISTINCT FROM p_ficha THEN
 UPDATE lia_produtos SET ficha=p_ficha,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO n;
 INSERT INTO audit_log(user_id,modulo,acao,chave_unica,antes,depois,origem,descricao) VALUES(auth.uid(),'lia_conhecimento','editar_ficha',p_id::text,jsonb_build_object('ficha',v.ficha,'versao',v.updated_at),jsonb_build_object('ficha',n.ficha,'versao',n.updated_at),'lia_configuracoes','Atualização de conhecimento sem ativação de envio');
 ELSE n:=v; END IF;
 RETURN jsonb_build_object('id',n.id,'ficha',n.ficha,'updated_at',n.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.lia_salvar_ficha(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lia_salvar_ficha(uuid,timestamptz,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.lia_ler_configuracoes() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.ia_config; flag boolean; runs jsonb; historico jsonb;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO v FROM ia_config WHERE id=true;
 SELECT flag_value INTO flag FROM system_flags WHERE flag_name='lia_reengajamento_enabled';
 SELECT coalesce(jsonb_agg(jsonb_build_object('status',status,'cap_dia',cap_dia,'nome',nome)),'[]'::jsonb) INTO runs FROM lia_reengajamento_runs;
 SELECT coalesce(jsonb_agg(x),'[]'::jsonb) INTO historico FROM (SELECT created_at,user_id,antes,depois FROM audit_log WHERE modulo='lia_configuracoes' ORDER BY created_at DESC LIMIT 10) x;
 RETURN jsonb_build_object('config',v.lia_envio_programado,'versao',v.updated_at,'motor',flag,'lotes',runs,'isolado',jsonb_build_object('envio',v.enviar_habilitado,'inicio',v.janela_envio_inicio,'fim',v.janela_envio_fim),'historico',historico);
END $$;
REVOKE ALL ON FUNCTION public.lia_ler_configuracoes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lia_ler_configuracoes() TO authenticated;
CREATE OR REPLACE FUNCTION public.lia_salvar_configuracoes(p_config jsonb,p_versao timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.ia_config; c jsonb; lim integer; ini time; fim time; espera integer; dias jsonb;
BEGIN
 IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 SELECT * INTO v FROM ia_config WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuração indisponível'; END IF;
 IF v.updated_at IS DISTINCT FROM p_versao THEN RAISE EXCEPTION 'Configuração mudou. Atualize antes de salvar.'; END IF;
 lim:=(p_config->>'limite_dia')::integer; espera:=(p_config->>'espera_horas')::integer; ini:=(p_config->>'inicio')::time; fim:=(p_config->>'fim')::time; dias:=p_config->'dias';
 IF lim IS NULL OR lim<1 OR lim>100 OR espera IS NULL OR espera<24 OR espera>2160 OR ini IS NULL OR fim IS NULL OR ini>=fim OR jsonb_typeof(dias) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Limites ou horários inválidos. Piloto até 100/dia e espera mínima 24h.'; END IF;
 IF jsonb_array_length(dias)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(dias) d WHERE d !~ '^[0-6]$') THEN RAISE EXCEPTION 'Selecione dias válidos'; END IF;
 c:=jsonb_build_object('limite_dia',lim,'espera_horas',espera,'inicio',to_char(ini,'HH24:MI'),'fim',to_char(fim,'HH24:MI'),'dias',dias);
 UPDATE ia_config SET lia_envio_programado=c,updated_at=clock_timestamp() WHERE id=true;
 INSERT INTO audit_log(user_id,modulo,acao,antes,depois,origem,descricao) VALUES(auth.uid(),'lia_configuracoes','salvar_parametros',v.lia_envio_programado,c,'lia_configuracoes','Parâmetros salvos sem alterar switches, lotes ou campanhas');
 RETURN public.lia_ler_configuracoes();
END $$;
REVOKE ALL ON FUNCTION public.lia_salvar_configuracoes(jsonb,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lia_salvar_configuracoes(jsonb,timestamptz) TO authenticated;
CREATE OR REPLACE FUNCTION public.lia_reservar_envio(p_chave text,p_telefone text,p_origem text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb; dia date; h time; dow integer; usados integer; tel text; pl public.pipeline_leads; fonte public.pipeline_leads;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('lia_envio_programado'));
 SELECT lia_envio_programado INTO c FROM ia_config WHERE id=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('permitido',false,'motivo','config_indisponivel'); END IF;
 IF c IS NULL THEN RETURN jsonb_build_object('permitido',true,'legado',true); END IF;
 dia:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; h:=(now() AT TIME ZONE 'America/Sao_Paulo')::time; dow:=extract(dow FROM now() AT TIME ZONE 'America/Sao_Paulo');
 IF NOT (c->'dias') @> to_jsonb(ARRAY[dow]) OR h<(c->>'inicio')::time OR h>=(c->>'fim')::time THEN RETURN jsonb_build_object('permitido',false,'motivo','fora_janela'); END IF;
 tel:=right(regexp_replace(p_telefone,'[^0-9]','','g'),8);
 IF length(tel)<>8 OR length(p_chave)>200 OR p_origem NOT IN ('reengajamento','followup','proativo') THEN RETURN jsonb_build_object('permitido',false,'motivo','parametros_invalidos'); END IF;
 IF EXISTS(SELECT 1 FROM lia_estado WHERE right(regexp_replace(telefone,'[^0-9]','','g'),8)=tel AND optout=true) THEN RETURN jsonb_build_object('permitido',false,'motivo','optout'); END IF;
 IF p_origem='reengajamento' THEN
 SELECT p.* INTO fonte FROM lia_reengajamento_fila f JOIN pipeline_leads p ON p.id=f.pipeline_lead_id WHERE f.id::text=replace(p_chave,'reeng:','') AND f.status='pendente';
 ELSE
 SELECT p.* INTO fonte FROM lia_reengajamento_fila f JOIN pipeline_leads p ON p.id=f.pipeline_lead_id WHERE f.tel8=tel AND f.status='enviado' ORDER BY f.enviado_em DESC LIMIT 1;
 END IF;
 IF fonte.id IS NULL OR (fonte.stage_id<>'1dd66c25-3848-4053-9f66-82e902989b4d'::uuid AND NOT fonte.arquivado) THEN RETURN jsonb_build_object('permitido',false,'motivo','origem_descarte_nao_confirmada'); END IF;
 IF fonte.tipo_descarte='definitivo' OR fonte.stage_changed_at IS NULL OR fonte.stage_changed_at>now()-make_interval(hours=>(c->>'espera_horas')::integer) THEN RETURN jsonb_build_object('permitido',false,'motivo','descarte_inelegivel'); END IF;
 IF EXISTS(SELECT 1 FROM pipeline_leads p WHERE right(regexp_replace(p.telefone,'[^0-9]','','g'),8)=tel AND NOT p.arquivado AND p.stage_id<>'1dd66c25-3848-4053-9f66-82e902989b4d'::uuid) THEN RETURN jsonb_build_object('permitido',false,'motivo','cliente_ativo'); END IF;
 IF EXISTS(SELECT 1 FROM lia_envio_reservas WHERE chave=p_chave) THEN RETURN jsonb_build_object('permitido',false,'motivo','ja_reservado'); END IF;
 SELECT count(*) INTO usados FROM lia_envio_reservas WHERE lia_envio_reservas.dia=dia;
 IF usados>=(c->>'limite_dia')::integer THEN RETURN jsonb_build_object('permitido',false,'motivo','limite_dia'); END IF;
 INSERT INTO lia_envio_reservas(dia,chave,telefone,origem) VALUES(dia,p_chave,tel,p_origem);
 RETURN jsonb_build_object('permitido',true,'legado',false);
END $$;
REVOKE ALL ON FUNCTION public.lia_reservar_envio(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lia_reservar_envio(text,text,text) TO service_role;
COMMENT ON COLUMN public.ia_config.lia_envio_programado IS 'Null preserves legacy paths. Saving limits never activates switches or runs. Explicit initialization is administrative.';