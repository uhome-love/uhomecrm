-- Rollback memory: drop new policies/index, then ALTER TABLE public.homi_memoria_lead ADD CONSTRAINT homi_memoria_lead_lead_id_chave_key UNIQUE(lead_id,chave) (resolve per-author duplicates first).
-- Original policy: CREATE POLICY memoria_lead_own ON public.homi_memoria_lead FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
-- Dossier rollback: keep homi_dossie_ativo false; revoke/drop new dossier/memory RPCs and private helpers. No original CRM function is replaced.
CREATE FUNCTION public.homi_normaliza_tel(p_tel text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT CASE WHEN length(n) IN (10,11) THEN left(n,2)||right(n,8) ELSE NULL END FROM (SELECT public.normalize_telefone(p_tel) n) x; $$;
REVOKE ALL ON FUNCTION public.homi_normaliza_tel(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.homi_normaliza_tel(text) TO authenticated,service_role;
CREATE INDEX homi_tel_pipeline ON public.pipeline_leads(public.homi_normaliza_tel(telefone_normalizado));
CREATE INDEX homi_tel_lia ON public.lia_conversas(public.homi_normaliza_tel(telefone));
CREATE INDEX homi_tel_respostas ON public.whatsapp_respostas(public.homi_normaliza_tel(phone));
CREATE INDEX homi_tel_oa ON public.oferta_ativa_leads(public.homi_normaliza_tel(telefone_normalizado));
CREATE FUNCTION public.homi_campos(j jsonb,campos text[]) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT coalesce(jsonb_object_agg(key,value),'{}') FROM jsonb_each(j) WHERE key=ANY(campos); $$;
REVOKE ALL ON FUNCTION public.homi_campos(jsonb,text[]) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.homi_bloco(d jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('status',CASE WHEN d IS NULL OR d IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) THEN 'vazio' ELSE 'ok' END,'dados',coalesce(d,'null')); $$;
REVOKE ALL ON FUNCTION public.homi_bloco(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.homi_fato(d timestamptz,f text,a uuid,c uuid,r timestamptz) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT jsonb_build_object('data',d,'fonte',f,'ciclo',CASE WHEN d<r THEN 'anterior' ELSE 'atual' END,'autor_id',a,'outro_corretor',a IS NOT NULL AND a IS DISTINCT FROM c); $$;
REVOKE ALL ON FUNCTION public.homi_fato(timestamptz,text,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.homi_memoria_lead DROP CONSTRAINT homi_memoria_lead_lead_id_chave_key;
CREATE UNIQUE INDEX homi_memoria_lead_autor_chave ON public.homi_memoria_lead(lead_id,user_id,chave);
DROP POLICY memoria_lead_own ON public.homi_memoria_lead;
CREATE POLICY memoria_lead_read ON public.homi_memoria_lead FOR SELECT TO authenticated USING(public.can_access_lead(lead_id));
CREATE POLICY memoria_lead_insert ON public.homi_memoria_lead FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND public.can_access_lead(lead_id));
CREATE POLICY memoria_lead_update ON public.homi_memoria_lead FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.can_access_lead(lead_id)) WITH CHECK(user_id=auth.uid() AND public.can_access_lead(lead_id));
CREATE POLICY memoria_lead_delete ON public.homi_memoria_lead FOR DELETE TO authenticated USING(user_id=auth.uid() AND public.can_access_lead(lead_id));
COMMENT ON COLUMN public.homi_memoria_lead.valor IS 'Confirmed facts only. No phone/email/CPF/income/documents. Author/date retained; prior broker marked in dossier.';
CREATE FUNCTION public.homi_memoria_confirmar(p_lead uuid,p_chave text,p_valor text,p_confirmado boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT coalesce(public.can_access_lead(p_lead),false) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE='42501'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE='42501'; END IF;
 IF p_confirmado IS DISTINCT FROM true THEN RAISE EXCEPTION 'confirmação necessária'; END IF;
 IF p_chave IS NULL OR p_chave NOT IN ('decisor','objecao','prazo','orcamento','preferencia','observacao') THEN RAISE EXCEPTION 'assunto inválido'; END IF;
 IF p_valor IS NULL OR length(trim(p_valor)) NOT BETWEEN 1 AND 400 THEN RAISE EXCEPTION 'fato inválido'; END IF;
 IF p_valor ~* '(telefone|celular|whatsapp|e-?mail|cpf|renda|sal[aá]rio|documento|rg\M|https?://|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[0-9][0-9 .()+/-]{8,}[0-9])' THEN RAISE EXCEPTION 'dados pessoais não permitidos'; END IF;
 INSERT INTO public.homi_memoria_lead(user_id,lead_id,chave,valor) VALUES(auth.uid(),p_lead,p_chave,trim(p_valor)) ON CONFLICT(lead_id,user_id,chave) DO UPDATE SET valor=excluded.valor,updated_at=now() RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.homi_memoria_confirmar(uuid,text,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.homi_memoria_confirmar(uuid,text,text,boolean) TO authenticated;
CREATE FUNCTION public.homi_dossie_lead(p_lead uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp SET statement_timeout='5s' AS $$
DECLARE l public.pipeline_leads%ROWTYPE; s public.pipeline_stages%ROWTYPE; ref timestamptz; tel text; amb boolean; j jsonb; d jsonb; lia_resumo text;
BEGIN
 IF NOT coalesce(public.can_access_lead(p_lead),false) THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE='42501'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sem acesso' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT l FROM public.pipeline_leads WHERE id=p_lead;
 SELECT * INTO s FROM public.pipeline_stages WHERE id=l.stage_id;
 ref:=greatest(l.distribuido_em,l.aceito_em); tel:=public.homi_normaliza_tel(l.telefone_normalizado);
 SELECT count(*)>1 INTO amb FROM public.pipeline_leads WHERE NOT coalesce(arquivado,false) AND public.homi_normaliza_tel(telefone_normalizado)=tel;
 j:=jsonb_build_object('versao','passo2-2026-11-05','gerado_em',now(),'timezone','America/Sao_Paulo','lacunas',jsonb_build_array(),
 'lead',public.homi_bloco(public.homi_campos(to_jsonb(l),ARRAY['id','nome','empreendimento','temperatura','flag_status','ultimo_toque_at','arquivado','estagnado','corretor_id','reaproveitado_em'])||jsonb_build_object('etapa',s.nome,'etapa_tipo',s.tipo,'ciclo_atual_desde',ref,'saude',public.lead_saude_status(l.ultimo_toque_at,ref,s.tipo::text),'dias_sem_toque',floor(extract(epoch from(now()-greatest(l.ultimo_toque_at,ref)))/86400))),
 'qualificacao',public.homi_bloco(public.homi_campos(to_jsonb(l),ARRAY['form_respostas','objetivo_cliente','faixa_valor','prazo_decisao','forma_pagamento','imovel_troca','bairro_regiao','radar_quartos','radar_valor_max','radar_tipologia','radar_bairros','radar_status_imovel','radar_atualizado_em','campanha','anuncio','formulario','form_name','origem','origem_detalhe'])||public.homi_fato(l.updated_at,'pipeline_leads',NULL,l.corretor_id,ref)));
 BEGIN
 SELECT jsonb_build_object('total',count(*),'primeira',min(created_at),'ultima',max(created_at),'por_tipo',(SELECT coalesce(jsonb_object_agg(tipo,n),'{}') FROM(SELECT coalesce(tipo,'outro') tipo,count(*) n FROM public.pipeline_atividades WHERE pipeline_lead_id=p_lead GROUP BY 1)x),'fatos',coalesce(jsonb_agg(public.homi_fato(created_at,'pipeline_atividades',coalesce(created_by,responsavel_id),l.corretor_id,ref)||jsonb_build_object('id',id,'tipo',tipo,'titulo',titulo,'descricao_resumo',left(descricao,500),'resultado',resultado) ORDER BY created_at,id),'[]')) INTO d FROM public.pipeline_atividades WHERE pipeline_lead_id=p_lead;
 j:=j||jsonb_build_object('timeline',CASE WHEN (d->>'total')::int=0 THEN public.homi_bloco('[]') ELSE public.homi_bloco(d) END);
 SELECT jsonb_agg(public.homi_campos(to_jsonb(a),ARRAY['id','tipo','titulo','descricao','resultado','tipo_contato'])||public.homi_fato(created_at,'pipeline_atividades',coalesce(created_by,responsavel_id),l.corretor_id,ref) ORDER BY created_at DESC,id DESC) INTO d FROM(SELECT * FROM public.pipeline_atividades WHERE pipeline_lead_id=p_lead ORDER BY created_at DESC,id DESC LIMIT 8)a;
 j:=j||jsonb_build_object('atividades_recentes',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('timeline',jsonb_build_object('status','indisponível','dados',NULL),'atividades_recentes',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(a),ARRAY['id','conteudo','autor_nome','fixada'])||public.homi_fato(created_at,'pipeline_anotacoes',autor_id,l.corretor_id,ref) ORDER BY fixada DESC,created_at DESC,id DESC) INTO d FROM public.pipeline_anotacoes a WHERE pipeline_lead_id=p_lead AND(fixada OR id IN(SELECT id FROM public.pipeline_anotacoes WHERE pipeline_lead_id=p_lead ORDER BY created_at DESC,id DESC LIMIT 5));
 j:=j||jsonb_build_object('anotacoes',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('anotacoes',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_fato(h.created_at,'pipeline_historico',movido_por,l.corretor_id,ref)||jsonb_build_object('id',h.id,'de',a.nome,'para',b.nome,'observacao',h.observacao) ORDER BY h.created_at,h.id) INTO d FROM public.pipeline_historico h LEFT JOIN public.pipeline_stages a ON a.id=h.stage_anterior_id LEFT JOIN public.pipeline_stages b ON b.id=h.stage_novo_id WHERE h.pipeline_lead_id=p_lead;
 j:=j||jsonb_build_object('mudancas_etapa',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('mudancas_etapa',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(v),ARRAY['id','data_visita','hora_visita','status','resultado_visita','objecao','confirmed_at','cancel_reason','confirmacao_status','resposta_texto','toque_d1_at'])||public.homi_fato(created_at,'visitas',corretor_id,l.corretor_id,ref) ORDER BY data_visita,hora_visita,id) INTO d FROM public.visitas v WHERE pipeline_lead_id=p_lead;
 j:=j||jsonb_build_object('visitas',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('visitas',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(t),ARRAY['id','titulo','tipo','subtipo','vence_em','hora_vencimento','status','origem','adiamentos_count'])||public.homi_fato(created_at,'pipeline_tarefas',created_by,l.corretor_id,ref) ORDER BY vence_em,id) INTO d FROM public.pipeline_tarefas t WHERE pipeline_lead_id=p_lead AND status='pendente';
 j:=j||jsonb_build_object('tarefas',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('tarefas',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(e),ARRAY['status','resumo','nivel','agendou','agendamento','qualificado_em','motivo','optout','repassado_em','produto_slug'])||public.homi_fato(updated_at,'lia_estado',NULL,l.corretor_id,ref) ORDER BY updated_at DESC),string_agg(nullif(trim(resumo),''),' ') INTO d,lia_resumo FROM public.lia_estado e WHERE lead_id=p_lead;
 j:=j||jsonb_build_object('lia_estado',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('lia_estado',jsonb_build_object('status','indisponível','dados',NULL)); END;
 IF tel IS NULL OR amb THEN
 j:=j||jsonb_build_object('lia_conversas',jsonb_build_object('status','indisponível','dados',NULL),'whatsapp_respostas',jsonb_build_object('status','indisponível','dados',NULL),'oferta_ativa',jsonb_build_object('status','indisponível','dados',NULL),'lacunas',jsonb_build_array(CASE WHEN amb THEN 'telefone ambíguo: junção recusada' ELSE 'telefone inválido: junção recusada' END));
 ELSE
 BEGIN
 IF lia_resumo IS NOT NULL THEN d:=jsonb_build_object('resumo_disponivel',true,'mensagens_nao_lidas',true); ELSE
 SELECT jsonb_agg(public.homi_campos(to_jsonb(c),ARRAY['id','role','conteudo'])||public.homi_fato(created_at,'lia_conversas',NULL,l.corretor_id,ref) ORDER BY created_at DESC,id DESC) INTO d FROM(SELECT * FROM public.lia_conversas WHERE public.homi_normaliza_tel(telefone)=tel AND NOT EXISTS(SELECT 1 FROM public.lia_estado WHERE public.homi_normaliza_tel(telefone)=tel AND lead_id IS NOT NULL AND lead_id<>p_lead) ORDER BY created_at DESC,id DESC LIMIT 3)c; END IF;
 j:=j||jsonb_build_object('lia_conversas',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('lia_conversas',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(w),ARRAY['id','campanha','mensagem'])||public.homi_fato(created_at,'whatsapp_respostas',NULL,l.corretor_id,ref) ORDER BY created_at DESC,id DESC) INTO d FROM public.whatsapp_respostas w WHERE public.homi_normaliza_tel(phone)=tel;
 j:=j||jsonb_build_object('whatsapp_respostas',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('whatsapp_respostas',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(t),ARRAY['id','resultado','feedback','canal'])||public.homi_fato(t.created_at,'oferta_ativa_tentativas',t.corretor_id,l.corretor_id,ref) ORDER BY t.created_at DESC,t.id DESC) INTO d FROM public.oferta_ativa_tentativas t JOIN public.oferta_ativa_leads o ON o.id=t.lead_id WHERE public.homi_normaliza_tel(o.telefone_normalizado)=tel AND t.corretor_id=l.corretor_id;
 j:=j||jsonb_build_object('oferta_ativa',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('oferta_ativa',jsonb_build_object('status','indisponível','dados',NULL)); END;
 END IF;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(n),ARRAY['id','fase','vgv_estimado','proposta_situacao','negociacao_situacao','documentacao_situacao','contrato_situacao','data_assinatura','distrato_em'])||public.homi_fato(updated_at,'negocios',auth_user_id,l.corretor_id,ref) ORDER BY updated_at DESC,id) INTO d FROM public.negocios n WHERE pipeline_lead_id=p_lead;
 j:=j||jsonb_build_object('negocios',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('negocios',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(p),ARRAY['id','corretor_principal_id','corretor_parceiro_id','status'])||public.homi_fato(created_at,'pipeline_parcerias',criado_por,l.corretor_id,ref) ORDER BY created_at DESC,id) INTO d FROM public.pipeline_parcerias p WHERE pipeline_lead_id=p_lead AND status='ativa';
 j:=j||jsonb_build_object('parceria',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('parceria',jsonb_build_object('status','indisponível','dados',NULL)); END;
 BEGIN
 SELECT jsonb_agg(public.homi_campos(to_jsonb(m),ARRAY['id','chave','valor','created_at'])||public.homi_fato(m.updated_at,'homi_memoria_lead',m.user_id,l.corretor_id,ref)||jsonb_build_object('autor',p.nome) ORDER BY m.updated_at DESC,m.id) INTO d FROM public.homi_memoria_lead m LEFT JOIN public.profiles p ON p.user_id=m.user_id WHERE m.lead_id=p_lead;
 j:=j||jsonb_build_object('memoria',public.homi_bloco(d));
 EXCEPTION WHEN OTHERS THEN j:=j||jsonb_build_object('memoria',jsonb_build_object('status','indisponível','dados',NULL)); END;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.homi_dossie_lead(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.homi_dossie_lead(uuid) TO authenticated;
COMMENT ON FUNCTION public.homi_dossie_lead(uuid) IS 'Allowlisted authenticated dossier; can_access_lead first. Database health, source/cycle/status. OA current broker only. Shared homiDossie.ts sanitizes AI projection. Keep system_flags false until approval.';