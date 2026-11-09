CREATE OR REPLACE FUNCTION public.oa_ranking_ligacoes(p_periodo text DEFAULT 'semana')
RETURNS TABLE(user_id uuid, nome text, avatar_url text, ligacoes int, aproveitados int, visitas int, posicao int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 WITH janela AS (
   SELECT (CASE WHEN p_periodo='dia' THEN date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo') ELSE date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo') END) AT TIME ZONE 'America/Sao_Paulo' AS inicio,
          now() AS fim
 ), eventos AS (
   SELECT t.corretor_id AS uid, count(*) FILTER (WHERE t.canal='ligacao') AS l,
          count(*) FILTER (WHERE t.resultado='com_interesse') AS a
   FROM public.oferta_ativa_tentativas t CROSS JOIN janela j
   WHERE t.created_at>=j.inicio AND t.created_at<=j.fim GROUP BY t.corretor_id
   UNION ALL
   SELECT p.user_id, count(*), count(*) FILTER (WHERE t.resultado IN ('aproveitado','visita_agendada'))
   FROM public.oferta_ativa_ligacoes t JOIN public.profiles p ON p.id=t.corretor_id CROSS JOIN janela j
   WHERE t.created_at>=j.inicio AND t.created_at<=j.fim
     AND coalesce(t.origem,'mutirao')='mutirao'
     AND t.resultado IN ('nao_atendeu','sem_interesse','aproveitado','visita_agendada')
   GROUP BY p.user_id
 ), agregado AS (
   SELECT uid,sum(l)::int AS l,sum(a)::int AS a FROM eventos GROUP BY uid
 ), vis AS (
   SELECT v.corretor_id AS uid,count(*)::int AS v FROM public.visitas_unicas v CROSS JOIN janela j
   WHERE v.created_at>=j.inicio AND v.created_at<=j.fim
     AND v.status IN ('marcada','confirmada','realizada','reagendada') GROUP BY v.corretor_id
 )
 SELECT CASE WHEN auth.uid() IS NOT NULL THEN p.user_id ELSE NULL::uuid END,
   split_part(coalesce(p.nome,''),' ',1)||coalesce(' '||left(nullif(split_part(p.nome,' ',2),''),1)||'.',''),
   CASE WHEN auth.uid() IS NOT NULL THEN p.avatar_url ELSE NULL::text END,
   a.l,a.a,coalesce(v.v,0),
   (row_number() OVER (ORDER BY a.l DESC,p.nome,p.user_id))::int
 FROM agregado a JOIN public.profiles p ON p.user_id=a.uid LEFT JOIN vis v ON v.uid=a.uid
 WHERE a.l>0 ORDER BY a.l DESC,p.nome,p.user_id LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.oa_ranking_ligacoes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oa_ranking_ligacoes(text) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.oa_ranking_ligacoes(text) IS 'Calls by BRT day/week: OA uses auth ID, Mutirao uses profile ID. Skips and synthetic pipeline visit events are excluded. Anonymous TV output redacts user ID and avatar. Ties depend only on call count and stable name order.';

DO $guard$
DECLARE r record; definition text;
BEGIN
 FOR r IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('fetch_next_lead','fetch_next_lead_campaign') LOOP
  definition:=pg_get_functiondef(r.oid);
  definition:=replace(definition, 'v_today_start timestamptz := date_trunc(''day'', v_now);', 'v_today_start timestamptz := date_trunc(''day'', v_now AT TIME ZONE ''America/Sao_Paulo'') AT TIME ZONE ''America/Sao_Paulo'';');
  IF position('AND NOT public.contato_bloqueado(l.telefone)' in definition)=0 THEN
   definition:=replace(definition, 'AND l.status IN (''na_fila'', ''em_cooldown'')', 'AND l.status IN (''na_fila'', ''em_cooldown'') AND NOT public.contato_bloqueado(l.telefone) AND (nullif(trim(l.telefone2),'''') IS NULL OR NOT public.contato_bloqueado(l.telefone2))');
  END IF;
  EXECUTE definition;
 END LOOP;
END
$guard$;

CREATE OR REPLACE FUNCTION public.bolsao_registrar(p_lead_id uuid,p_resultado text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_uid uuid:=auth.uid(); v_res public.bolsao_reservas; v_descarte uuid;
BEGIN
 SELECT * INTO v_res FROM public.bolsao_reservas WHERE pipeline_lead_id=p_lead_id FOR UPDATE;
 IF v_uid IS NULL OR v_res IS NULL OR v_res.corretor_id IS DISTINCT FROM v_uid THEN
   RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada');
 END IF;
 IF p_resultado='liberar' THEN
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
   RETURN jsonb_build_object('ok',true);
 END IF;
 IF v_res.reservado_ate IS NULL THEN
   IF v_res.ultimo_resultado=p_resultado THEN RETURN jsonb_build_object('ok',true,'idempotent',true); END IF;
   RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada');
 END IF;
 IF v_res.reservado_ate<=now() THEN RETURN jsonb_build_object('ok',false,'error','reserva_nao_encontrada'); END IF;
 IF p_resultado='nao_atendeu' THEN
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,cooldown_ate=now()+interval '24 hours',ultimo_resultado='nao_atendeu',tentativas=tentativas+1,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
 ELSIF p_resultado='sem_interesse' THEN
   SELECT id INTO v_descarte FROM public.pipeline_stages WHERE tipo='descarte' AND pipeline_tipo='leads' ORDER BY ordem LIMIT 1;
   UPDATE public.pipeline_leads SET stage_id=coalesce(v_descarte,stage_id),stage_changed_at=now(),tipo_descarte='definitivo',motivo_descarte='Sem interesse (Bolsão)',arquivado=true,estagnado=false,updated_at=now() WHERE id=p_lead_id;
   UPDATE public.bolsao_reservas SET reservado_ate=NULL,ultimo_resultado='sem_interesse',tentativas=tentativas+1,updated_at=now() WHERE pipeline_lead_id=p_lead_id;
 ELSE RETURN jsonb_build_object('ok',false,'error','resultado_invalido');
 END IF;
 RETURN jsonb_build_object('ok',true);
END
$$;