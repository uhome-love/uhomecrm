CREATE OR REPLACE FUNCTION public.trg_visita_conta_mutirao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sessao_id uuid;
  v_profile_id uuid;
  v_nome text;
  v_gerente_auth uuid;
  v_gerente uuid;
  v_equipe text;
  v_chave text;
BEGIN
  SELECT id INTO v_sessao_id
    FROM public.oferta_ativa_sessoes
   WHERE status = 'ao_vivo' AND inicio_at <= now() AND fim_at >= now()
   ORDER BY inicio_at DESC LIMIT 1;
  IF v_sessao_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.corretor_id IS NULL THEN RETURN NEW; END IF;

  SELECT p.id, p.nome INTO v_profile_id, v_nome
    FROM public.profiles p WHERE p.user_id = NEW.corretor_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    SELECT p.id, p.nome INTO v_profile_id, v_nome
      FROM public.profiles p WHERE p.id = NEW.corretor_id LIMIT 1;
  END IF;
  IF v_profile_id IS NULL THEN RETURN NEW; END IF;

  -- Chave SSOT: lead do pipeline > telefone (só dígitos) > nome normalizado
  v_chave := COALESCE(
    NEW.pipeline_lead_id::text,
    NULLIF(regexp_replace(COALESCE(NEW.telefone, ''), '\D', '', 'g'), ''),
    lower(btrim(COALESCE(NEW.nome_cliente, '')))
  );

  -- Regra SSOT: cliente inédito. Qualquer visita anterior do mesmo cliente
  -- (qualquer data) bloqueia — remarcação não pontua de novo.
  IF EXISTS (
    SELECT 1 FROM public.visitas v2
     WHERE v2.id <> NEW.id
       AND COALESCE(
             v2.pipeline_lead_id::text,
             NULLIF(regexp_replace(COALESCE(v2.telefone, ''), '\D', '', 'g'), ''),
             lower(btrim(COALESCE(v2.nome_cliente, '')))
           ) = v_chave
       AND v2.created_at <= NEW.created_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Já pontuado nesta sessão pelo fluxo do mutirão para o mesmo lead/cliente
  IF EXISTS (
    SELECT 1 FROM public.oferta_ativa_ligacoes l
     WHERE l.sessao_id = v_sessao_id
       AND l.resultado = 'visita_agendada'
       AND (
         (NEW.pipeline_lead_id IS NOT NULL AND l.pipeline_lead_id = NEW.pipeline_lead_id)
         OR (NEW.pipeline_lead_id IS NULL AND l.corretor_id = v_profile_id AND l.created_at > now() - interval '15 minutes')
       )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id INTO v_gerente_auth
    FROM public.team_members tm
   WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo'
   ORDER BY tm.created_at DESC LIMIT 1;

  IF v_gerente_auth IS NOT NULL THEN
    SELECT gp.id, split_part(gp.nome, ' ', 1) INTO v_gerente, v_equipe
      FROM public.profiles gp
     WHERE gp.user_id = v_gerente_auth OR gp.id = v_gerente_auth
     LIMIT 1;
  END IF;

  INSERT INTO public.oferta_ativa_participantes
    (sessao_id, corretor_id, gerente_id, equipe_text, visitas_count, pontos, ultima_acao_at)
  VALUES (v_sessao_id, v_profile_id, v_gerente, v_equipe, 1, 30, now())
  ON CONFLICT (sessao_id, corretor_id) DO UPDATE
    SET visitas_count = public.oferta_ativa_participantes.visitas_count + 1,
        pontos = public.oferta_ativa_participantes.pontos + 30,
        ultima_acao_at = now(),
        updated_at = now();

  INSERT INTO public.oferta_ativa_ligacoes
    (sessao_id, pipeline_lead_id, corretor_id, resultado, pontos, origem, observacao)
  VALUES (v_sessao_id, NEW.pipeline_lead_id, v_profile_id, 'visita_agendada', 30, 'pipeline',
          'Visita marcada fora do mutirão');

  INSERT INTO public.pulse_events (tipo, titulo, descricao, corretor_id, metadata)
  VALUES ('oa_visita',
          COALESCE(v_nome, 'Corretor') || ' agendou uma visita',
          COALESCE(NEW.nome_cliente, 'Cliente') || COALESCE(' · ' || NEW.empreendimento, ''),
          v_profile_id,
          jsonb_build_object('sessao_id', v_sessao_id, 'visita_id', NEW.id, 'origem', 'pipeline'));

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recomputar_placar_sessao(p_sessao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.oferta_ativa_participantes p
     SET visitas_count = COALESCE(t.visitas, 0),
         aproveitamentos_count = COALESCE(t.aproveitados, 0),
         ligacoes_count = COALESCE(t.ligacoes, p.ligacoes_count),
         pontos = COALESCE(t.pontos, 0),
         updated_at = now()
    FROM (
      SELECT l.corretor_id,
             count(*) FILTER (WHERE l.resultado = 'visita_agendada') AS visitas,
             count(*) FILTER (WHERE l.resultado = 'aproveitado') AS aproveitados,
             count(*) FILTER (WHERE l.origem = 'mutirao' AND l.resultado NOT IN ('pulado')) AS ligacoes,
             COALESCE(sum(l.pontos), 0) AS pontos
        FROM public.oferta_ativa_ligacoes l
       WHERE l.sessao_id = p_sessao_id
       GROUP BY l.corretor_id
    ) t
   WHERE p.sessao_id = p_sessao_id AND p.corretor_id = t.corretor_id;

  -- participantes sem nenhuma ação no extrato ficam zerados em pontuação
  UPDATE public.oferta_ativa_participantes p
     SET visitas_count = 0, aproveitamentos_count = 0, pontos = 0, updated_at = now()
   WHERE p.sessao_id = p_sessao_id
     AND NOT EXISTS (
       SELECT 1 FROM public.oferta_ativa_ligacoes l
        WHERE l.sessao_id = p_sessao_id AND l.corretor_id = p.corretor_id
     )
     AND (p.pontos <> 0 OR p.visitas_count <> 0 OR p.aproveitamentos_count <> 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.recomputar_placar_sessao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recomputar_placar_sessao(uuid) TO service_role;