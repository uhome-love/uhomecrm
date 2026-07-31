CREATE OR REPLACE FUNCTION public.rpc_placar_mutirao(p_sessao_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sessao public.oferta_ativa_sessoes%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_sessao_id IS NOT NULL THEN
    SELECT * INTO v_sessao FROM public.oferta_ativa_sessoes WHERE id = p_sessao_id;
  ELSE
    SELECT * INTO v_sessao
      FROM public.oferta_ativa_sessoes
     WHERE status = 'ao_vivo'
       AND inicio_at <= now()
       AND fim_at   >= now()
     ORDER BY inicio_at DESC
     LIMIT 1;
  END IF;

  IF v_sessao.id IS NULL THEN
    RETURN jsonb_build_object('sessao', NULL, 'corretores', '[]'::jsonb, 'equipes', '[]'::jsonb, 'feed', '[]'::jsonb);
  END IF;

  WITH corretor_profiles AS (
    SELECT p.id AS profile_id, p.nome, p.avatar_url, p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'corretor'
  ),
  ledger AS (
    SELECT l.corretor_id,
           COALESCE(SUM(l.pontos), 0)::int AS pontos,
           COUNT(*) FILTER (WHERE l.resultado <> 'pulado')::int AS ligacoes,
           COUNT(*) FILTER (WHERE l.resultado = 'aproveitado')::int AS aproveitamentos,
           COUNT(*) FILTER (WHERE l.resultado = 'visita_agendada')::int AS visitas
      FROM public.oferta_ativa_ligacoes l
     WHERE l.sessao_id = v_sessao.id
     GROUP BY l.corretor_id
  ),
  parts AS (
    SELECT part.corretor_id, part.gerente_id, part.equipe_text,
           COALESCE(lg.pontos, 0) AS pontos,
           COALESCE(lg.ligacoes, 0) AS ligacoes,
           COALESCE(lg.aproveitamentos, 0) AS aproveitamentos,
           COALESCE(lg.visitas, 0) AS visitas,
           part.status_online, part.ultima_acao_at,
           cp.nome, cp.avatar_url
      FROM public.oferta_ativa_participantes part
      JOIN corretor_profiles cp ON cp.profile_id = part.corretor_id
      LEFT JOIN ledger lg ON lg.corretor_id = part.corretor_id
     WHERE part.sessao_id = v_sessao.id
  ),
  corretores AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'corretor_id', corretor_id,
      'nome', COALESCE(nome, '—'),
      'foto_url', avatar_url,
      'gerente_id', gerente_id,
      'equipe', equipe_text,
      'pontos', pontos,
      'ligacoes', ligacoes,
      'aproveitamentos', aproveitamentos,
      'visitas', visitas,
      'status_online', status_online,
      'ultima_acao_at', ultima_acao_at
    ) ORDER BY pontos DESC), '[]'::jsonb) AS arr
    FROM parts
  ),
  equipes_agg AS (
    SELECT COALESCE(equipe_text, 'Sem equipe') AS equipe,
           gerente_id,
           SUM(pontos) AS pontos,
           SUM(ligacoes) AS ligacoes,
           SUM(aproveitamentos) AS aproveitamentos,
           SUM(visitas) AS visitas,
           COUNT(*)::int AS corretores
      FROM parts
     GROUP BY equipe_text, gerente_id
  ),
  equipes AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'equipe', equipe,
      'gerente_id', gerente_id,
      'pontos', pontos,
      'ligacoes', ligacoes,
      'aproveitamentos', aproveitamentos,
      'visitas', visitas,
      'corretores', corretores
    ) ORDER BY pontos DESC), '[]'::jsonb) AS arr
    FROM equipes_agg
  ),
  feed_rows AS (
    SELECT lig.corretor_id,
           split_part(COALESCE(cp.nome, '—'), ' ', 1) AS corretor,
           lig.resultado AS tipo,
           lig.created_at,
           to_char(lig.created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS hora,
           v.nome_cliente AS cliente,
           v.empreendimento
      FROM public.oferta_ativa_ligacoes lig
      LEFT JOIN corretor_profiles cp ON cp.profile_id = lig.corretor_id
      LEFT JOIN LATERAL (
        SELECT nome_cliente, empreendimento
          FROM public.visitas
         WHERE pipeline_lead_id = lig.pipeline_lead_id
         ORDER BY created_at DESC
         LIMIT 1
      ) v ON true
     WHERE lig.sessao_id = v_sessao.id
       AND lig.resultado IN ('visita_agendada', 'aproveitado')
     ORDER BY lig.created_at DESC
     LIMIT 12
  ),
  feed AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'corretor_id', corretor_id,
      'corretor', corretor,
      'tipo', tipo,
      'created_at', created_at,
      'hora', hora,
      'cliente', cliente,
      'empreendimento', empreendimento
    ) ORDER BY created_at DESC), '[]'::jsonb) AS arr
    FROM feed_rows
  )
  SELECT jsonb_build_object(
    'sessao', jsonb_build_object(
      'id', v_sessao.id,
      'status', v_sessao.status,
      'inicio_at', v_sessao.inicio_at,
      'fim_at', v_sessao.fim_at,
      'data', v_sessao.data
    ),
    'corretores', (SELECT arr FROM corretores),
    'equipes', (SELECT arr FROM equipes),
    'feed', (SELECT arr FROM feed),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

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

  -- Regra SSOT: uma visita por cliente por dia (qualquer visita anterior no mesmo dia bloqueia)
  IF EXISTS (
    SELECT 1 FROM public.visitas v2
     WHERE v2.id <> NEW.id
       AND v2.data_visita = NEW.data_visita
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
       AND l.corretor_id = v_profile_id
       AND l.resultado = 'visita_agendada'
       AND (
         (NEW.pipeline_lead_id IS NOT NULL AND l.pipeline_lead_id = NEW.pipeline_lead_id)
         OR (NEW.pipeline_lead_id IS NULL AND l.created_at > now() - interval '15 minutes')
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