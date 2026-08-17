CREATE OR REPLACE FUNCTION public.lead_em_estado_final(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_leads pl
    LEFT JOIN public.pipeline_stages ps ON ps.id = pl.stage_id
    WHERE pl.id = p_lead_id
      AND (
        ps.tipo IN ('venda', 'contrato_gerado')
        OR EXISTS (
          SELECT 1 FROM public.negocios n
          WHERE n.fase = 'ganho'
            AND COALESCE(n.status, 'ativo') = 'ativo'
            AND (n.id = pl.negocio_id OR n.pipeline_lead_id = pl.id OR n.lead_id = pl.id)
        )
      )
  );
$function$;
REVOKE ALL ON FUNCTION public.lead_em_estado_final(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_em_estado_final(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rejeitar_lead(p_lead_id uuid, p_corretor_id uuid, p_motivo text DEFAULT 'outro'::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_lead record; v_now timestamptz := now();
BEGIN
  PERFORM public.assert_acts_as(p_corretor_id);
  SELECT id, corretor_id, aceite_status INTO v_lead FROM pipeline_leads WHERE id=p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'reason','lead_not_found'); END IF;
  IF public.lead_em_estado_final(p_lead_id) THEN RETURN jsonb_build_object('success',false,'reason','lead_final_blocked'); END IF;
  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN RETURN jsonb_build_object('success',false,'reason','not_your_lead'); END IF;
  IF v_lead.aceite_status NOT IN ('pendente','aguardando_aceite','pendente_aceite') THEN RETURN jsonb_build_object('success',false,'reason','not_pending'); END IF;
  UPDATE pipeline_leads SET aceite_status='pendente_distribuicao',corretor_id=NULL,distribuido_em=NULL,aceite_expira_em=NULL,updated_at=v_now WHERE id=p_lead_id;
  UPDATE roleta_distribuicoes SET status='recusado' WHERE lead_id=p_lead_id AND status='aguardando';
  INSERT INTO distribuicao_historico(pipeline_lead_id,corretor_id,acao,motivo_rejeicao) VALUES(p_lead_id,p_corretor_id,'rejeitado',p_motivo);
  RETURN jsonb_build_object('success',true);
END;$function$;
REVOKE ALL ON FUNCTION public.rejeitar_lead(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rejeitar_lead(uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expirar_aceites_roleta()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_count int:=0; v_lead record;
BEGIN
 FOR v_lead IN SELECT pl.id,pl.corretor_id,pl.nome,pl.empreendimento FROM public.pipeline_leads pl WHERE pl.aceite_status='aguardando_aceite' AND pl.aceite_expira_em IS NOT NULL AND pl.aceite_expira_em < now()-interval '30 seconds' AND NOT public.lead_em_estado_final(pl.id) FOR UPDATE SKIP LOCKED LOOP
  UPDATE public.roleta_distribuicoes SET status='expirado' WHERE lead_id=v_lead.id AND status='aguardando';
  IF v_lead.corretor_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,tipo,categoria,titulo,mensagem,dados,agrupamento_key) VALUES(v_lead.corretor_id,'lead','lead_expirado','⏰ Lead perdido por expiração','Você perdeu o lead '||COALESCE(v_lead.nome,'sem nome')||COALESCE(' — '||v_lead.empreendimento,'')||'. O tempo de 10 minutos para aceitar expirou e ele voltou para a fila.',jsonb_build_object('pipeline_lead_id',v_lead.id,'lead_nome',v_lead.nome,'empreendimento',v_lead.empreendimento,'motivo','sla_expirado'),'lead_expirado_'||v_lead.id::text); END IF;
  UPDATE public.pipeline_leads SET aceite_status='pendente_distribuicao',corretor_id=NULL,distribuido_em=NULL,aceite_expira_em=NULL,updated_at=now() WHERE id=v_lead.id;
  INSERT INTO public.distribuicao_historico(pipeline_lead_id,corretor_id,acao,motivo_rejeicao,created_at) VALUES(v_lead.id,v_lead.corretor_id,'timeout','sla_expirado',now()); v_count:=v_count+1;
 END LOOP;
 RETURN jsonb_build_object('expired',v_count,'at',now());
END;$function$;

CREATE OR REPLACE FUNCTION public.reciclar_leads_expirados()
RETURNS TABLE(lead_id uuid,corretor_anterior uuid,lead_nome text,lead_empreendimento text,lead_telefone text,segmento_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_lead record; v_nome_anterior text;
BEGIN
 FOR v_lead IN SELECT pl.id,pl.corretor_id,pl.segmento_id seg_id,pl.distribuido_em,pl.nome,pl.empreendimento,pl.telefone,pl.stage_id FROM pipeline_leads pl WHERE pl.aceite_expira_em < now()-interval '30 seconds' AND pl.aceite_status IN ('pendente','aguardando_aceite') AND pl.corretor_id IS NOT NULL AND NOT public.lead_em_estado_final(pl.id) LOOP
  SELECT nome INTO v_nome_anterior FROM profiles WHERE user_id=v_lead.corretor_id;
  INSERT INTO distribuicao_historico(pipeline_lead_id,corretor_id,segmento_id,acao,motivo_rejeicao,tempo_resposta_seg) VALUES(v_lead.id,v_lead.corretor_id,v_lead.seg_id,'timeout','tempo_excedido. Corretor anterior: '||COALESCE(v_nome_anterior,'Desconhecido'),EXTRACT(EPOCH FROM(now()-v_lead.distribuido_em))::integer);
  UPDATE pipeline_leads SET corretor_id=NULL,distribuido_em=NULL,aceite_expira_em=NULL,aceite_status='pendente_distribuicao',updated_at=now() WHERE id=v_lead.id AND aceite_status IN ('pendente','aguardando_aceite');
  IF FOUND THEN INSERT INTO pipeline_historico(pipeline_lead_id,stage_anterior_id,stage_novo_id,movido_por,observacao) VALUES(v_lead.id,v_lead.stage_id,v_lead.stage_id,v_lead.corretor_id,'Lead expirou sem aceite e será redistribuído. Corretor anterior: '||COALESCE(v_nome_anterior,'Desconhecido')); lead_id:=v_lead.id;corretor_anterior:=v_lead.corretor_id;lead_nome:=v_lead.nome;lead_empreendimento:=v_lead.empreendimento;lead_telefone:=v_lead.telefone;segmento_id:=v_lead.seg_id;RETURN NEXT; END IF;
 END LOOP;
END;$function$;