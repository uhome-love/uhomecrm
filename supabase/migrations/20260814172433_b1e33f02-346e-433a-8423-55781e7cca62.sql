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

  -- Chave SSOT do cliente: lead do pipeline > telefone (só dígitos) > nome normalizado
  v_chave := COALESCE(
    NEW.pipeline_lead_id::text,
    NULLIF(regexp_replace(COALESCE(NEW.telefone, ''), '\D', '', 'g'), ''),
    lower(btrim(COALESCE(NEW.nome_cliente, '')))
  );

  -- Regra: 1 visita pontuada por cliente por sessão.
  -- Remarcação de cliente que já visitou em outras datas PONTUA;
  -- o que bloqueia é o mesmo cliente já ter pontuado nesta sessão.
  IF EXISTS (
    SELECT 1
      FROM public.oferta_ativa_ligacoes l
      LEFT JOIN public.pipeline_leads pl ON pl.id = l.pipeline_lead_id
     WHERE l.sessao_id = v_sessao_id
       AND l.resultado = 'visita_agendada'
       AND COALESCE(
             l.pipeline_lead_id::text,
             NULLIF(regexp_replace(COALESCE(pl.telefone, ''), '\D', '', 'g'), ''),
             ''
           ) = v_chave
  ) THEN
    RETURN NEW;
  END IF;

  -- Dedup extra: visita criada pelo próprio fluxo do mutirão (sem lead vinculado)
  IF NEW.pipeline_lead_id IS NULL AND EXISTS (
    SELECT 1 FROM public.oferta_ativa_ligacoes l
     WHERE l.sessao_id = v_sessao_id
       AND l.resultado = 'visita_agendada'
       AND l.corretor_id = v_profile_id
       AND l.created_at > now() - interval '15 minutes'
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
          'Visita marcada durante o mutirão');

  INSERT INTO public.pulse_events (tipo, titulo, descricao, corretor_id, metadata)
  VALUES ('oa_visita',
          COALESCE(v_nome, 'Corretor') || ' agendou uma visita',
          COALESCE(NEW.nome_cliente, 'Cliente') || COALESCE(' · ' || NEW.empreendimento, ''),
          v_profile_id,
          jsonb_build_object('sessao_id', v_sessao_id, 'visita_id', NEW.id, 'origem', 'pipeline'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;