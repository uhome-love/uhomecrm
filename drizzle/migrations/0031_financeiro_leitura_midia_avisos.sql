CREATE OR REPLACE FUNCTION public.financeiro_dados(p_inicio date,p_fim date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.financeiro_exigir_acesso();
 IF p_inicio IS NULL OR p_fim IS NULL OR p_fim<p_inicio THEN RAISE EXCEPTION 'Informe um período válido.'; END IF;
 SELECT jsonb_build_object(
 'vendas',COALESCE((SELECT jsonb_agg(to_jsonb(n)-ARRAY['cpf_cliente','telefone','email']) FROM public.negocios n WHERE n.fase='ganho' AND n.status IN ('ativo','distratado')),'[]'::jsonb),
 'intermediacoes',COALESCE((SELECT jsonb_agg(to_jsonb(i)-'payload') FROM public.intermediacoes i JOIN public.negocios n ON n.id=i.negocio_id WHERE i.status='ativa' AND n.fase='ganho' AND n.status IN ('ativo','distratado')),'[]'::jsonb),
 'beneficiarios',COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.intermediacao_beneficiarios b JOIN public.intermediacoes i ON i.id=b.intermediacao_id JOIN public.negocios n ON n.id=i.negocio_id WHERE i.status='ativa' AND n.fase='ganho' AND n.status IN ('ativo','distratado')),'[]'::jsonb),
 'recebimentos',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.negocios_recebimentos r JOIN public.intermediacoes i ON i.id=r.intermediacao_id JOIN public.negocios n ON n.id=i.negocio_id WHERE i.status='ativa' AND n.fase='ganho' AND n.status IN ('ativo','distratado')),'[]'::jsonb),
 'repasses',COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.financeiro_repasses r),'[]'::jsonb),
 'custos',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.custos_fixos c WHERE competencia BETWEEN p_inicio AND p_fim),'[]'::jsonb),
 'midia_manual',COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.custos_midia_manual c WHERE competencia BETWEEN p_inicio AND p_fim),'[]'::jsonb),
 'midia',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT dia,sum(spend) AS valor,max(sincronizado_em) AS atualizado_em FROM public.midia_snapshot_diario WHERE canal='meta' AND dia BETWEEN p_inicio AND p_fim GROUP BY dia ORDER BY dia) x),'[]'::jsonb),
 'cobertura_midia',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT since,until,max(terminado_em) AS atualizado_em FROM public.midia_sync_runs WHERE ok AND modo IN ('all','insights') AND terminado_em IS NOT NULL AND until>=p_inicio AND since<=p_fim GROUP BY since,until) x),'[]'::jsonb),
 'historico',COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.financeiro_historico WHERE created_at >= p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo' AND created_at < (p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo' ORDER BY created_at DESC LIMIT 500) x),'[]'::jsonb)
 ) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_dados(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.financeiro_dados(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.financeiro_alertar_parcelas() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_hoje date:=(now() AT TIME ZONE 'America/Sao_Paulo')::date; v_r record; v_u record; v_key text; v_total integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('financeiro_alertar_parcelas'));
 FOR v_r IN SELECT r.*,n.nome_cliente,n.empreendimento FROM public.negocios_recebimentos r JOIN public.intermediacoes i ON i.id=r.intermediacao_id JOIN public.negocios n ON n.id=i.negocio_id WHERE r.status='pendente' AND r.vencimento<=v_hoje+7 AND i.status='ativa' AND n.fase='ganho' AND n.status='ativo' LOOP
  FOR v_u IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','diretor') LOOP
   v_key:='financeiro:'||v_r.id||':'||v_r.vencimento||':'||CASE WHEN v_r.vencimento<v_hoje THEN 'atrasada' ELSE 'semana' END;
   IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=v_u.user_id AND agrupamento_key=v_key) THEN
    INSERT INTO public.notifications(user_id,tipo,categoria,titulo,mensagem,agrupamento_key,dados) VALUES(v_u.user_id,'alertas','financeiro_parcela',v_r.nome_cliente||' — Comissão '||CASE WHEN v_r.vencimento<v_hoje THEN 'vencida' ELSE 'a vencer' END,v_r.nome_cliente||' · '||COALESCE(v_r.empreendimento,'')||' · parcela '||v_r.parcela_num||' · vencimento '||to_char(v_r.vencimento,'DD/MM/YYYY'),v_key,jsonb_build_object('url','/financeiro?parcela='||v_r.id,'recebimento_id',v_r.id,'negocio_id',v_r.negocio_id)); v_total:=v_total+1;
   END IF;
  END LOOP;
 END LOOP;
 RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.financeiro_alertar_parcelas() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_alertar_parcelas() TO service_role;
SELECT cron.schedule('financeiro-parcelas-aviso','0 11 * * *','SELECT public.financeiro_alertar_parcelas();');