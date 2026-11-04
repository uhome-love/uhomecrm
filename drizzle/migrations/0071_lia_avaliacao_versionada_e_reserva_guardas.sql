CREATE OR REPLACE FUNCTION public.lia_avaliar_cenario(p_id uuid,p_avaliacao text,p_comentario text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.lia_laboratorio_execucoes; v timestamptz;
BEGIN
 IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'diretor')) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_avaliacao NOT IN ('ok','ajustar') OR (p_avaliacao='ajustar' AND length(trim(coalesce(p_comentario,'')))<5) THEN RAISE EXCEPTION 'Avaliação inválida'; END IF;
 SELECT * INTO e FROM lia_laboratorio_execucoes WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Execução não encontrada'; END IF;
 SELECT updated_at INTO v FROM lia_produtos WHERE slug=e.produto_slug;
 IF p_avaliacao='ok' AND e.produto_slug IS NOT NULL AND (e.ficha_versao IS NULL OR v IS DISTINCT FROM e.ficha_versao) THEN RAISE EXCEPTION 'Reexecute com a ficha atual antes de aprovar'; END IF;
 UPDATE lia_laboratorio_execucoes SET avaliacao=p_avaliacao,comentario=p_comentario,avaliado_por=auth.uid(),avaliado_em=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.lia_avaliar_cenario(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lia_avaliar_cenario(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.lia_reservar_envio(p_chave text,p_telefone text,p_origem text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c jsonb; v_dia date; h time; dow integer; usados integer; tel text; fonte public.pipeline_leads;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('lia_envio_programado'));
 SELECT lia_envio_programado INTO c FROM ia_config WHERE id=true;
 IF NOT FOUND THEN RETURN jsonb_build_object('permitido',false,'motivo','config_indisponivel'); END IF;
 IF c IS NULL THEN RETURN jsonb_build_object('permitido',true,'legado',true); END IF;
 IF NOT (c ?& ARRAY['dias','inicio','fim','limite_dia','espera_horas']) OR jsonb_typeof(c->'dias')<>'array' OR (c->>'limite_dia')::integer NOT BETWEEN 1 AND 100 OR (c->>'espera_horas')::integer<24 THEN RETURN jsonb_build_object('permitido',false,'motivo','config_invalida'); END IF;
 v_dia:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; h:=(now() AT TIME ZONE 'America/Sao_Paulo')::time; dow:=extract(dow FROM now() AT TIME ZONE 'America/Sao_Paulo');
 IF NOT (c->'dias') @> to_jsonb(ARRAY[dow]) OR h<(c->>'inicio')::time OR h>=(c->>'fim')::time THEN RETURN jsonb_build_object('permitido',false,'motivo','fora_janela'); END IF;
 tel:=right(regexp_replace(p_telefone,'[^0-9]','','g'),8);
 IF length(tel)<>8 OR p_chave IS NULL OR length(p_chave)>200 OR p_origem NOT IN ('reengajamento','followup','proativo') THEN RETURN jsonb_build_object('permitido',false,'motivo','parametros_invalidos'); END IF;
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
 SELECT count(*) INTO usados FROM lia_envio_reservas r WHERE r.dia=v_dia;
 IF usados>=(c->>'limite_dia')::integer THEN RETURN jsonb_build_object('permitido',false,'motivo','limite_dia'); END IF;
 INSERT INTO lia_envio_reservas(dia,chave,telefone,origem) VALUES(v_dia,p_chave,tel,p_origem);
 RETURN jsonb_build_object('permitido',true,'legado',false);
END $$;
REVOKE ALL ON FUNCTION public.lia_reservar_envio(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lia_reservar_envio(text,text,text) TO service_role;