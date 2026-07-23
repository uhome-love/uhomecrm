CREATE OR REPLACE FUNCTION public.rpc_placar_mutirao(p_sessao_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessao public.oferta_ativa_sessoes%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Descobrir sessão ativa
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
  parts AS (
    SELECT part.corretor_id, part.gerente_id, part.equipe_text,
           part.pontos, part.ligacoes_count, part.aproveitamentos_count, part.visitas_count,
           part.status_online, part.ultima_acao_at,
           cp.nome, cp.avatar_url
      FROM public.oferta_ativa_participantes part
      JOIN corretor_profiles cp ON cp.profile_id = part.corretor_id
     WHERE part.sessao_id = v_sessao.id
  ),
  corretores AS (
    SELECT jsonb_agg(jsonb_build_object(
      'corretor_id', corretor_id,
      'nome', COALESCE(nome, '—'),
      'foto_url', avatar_url,
      'gerente_id', gerente_id,
      'equipe', equipe_text,
      'pontos', COALESCE(pontos, 0),
      'ligacoes', COALESCE(ligacoes_count, 0),
      'aproveitamentos', COALESCE(aproveitamentos_count, 0),
      'visitas', COALESCE(visitas_count, 0),
      'status_online', status_online,
      'ultima_acao_at', ultima_acao_at
    ) ORDER BY COALESCE(pontos,0) DESC) AS arr
    FROM parts
  ),
  equipes AS (
    SELECT jsonb_agg(jsonb_build_object(
      'equipe', COALESCE(equipe_text, 'Sem equipe'),
      'gerente_id', gerente_id,
      'pontos', SUM(COALESCE(pontos,0)),
      'ligacoes', SUM(COALESCE(ligacoes_count,0)),
      'aproveitamentos', SUM(COALESCE(aproveitamentos_count,0)),
      'visitas', SUM(COALESCE(visitas_count,0)),
      'corretores', COUNT(*)
    ) ORDER BY SUM(COALESCE(pontos,0)) DESC) AS arr
    FROM parts
    GROUP BY equipe_text, gerente_id
  ),
  feed AS (
    SELECT jsonb_agg(item ORDER BY (item->>'created_at') DESC) AS arr FROM (
      SELECT jsonb_build_object(
        'corretor_id', lig.corretor_id,
        'corretor', split_part(COALESCE(cp.nome, '—'), ' ', 1),
        'tipo', lig.resultado,
        'created_at', lig.created_at,
        'hora', to_char(lig.created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        'cliente', v.nome_cliente,
        'empreendimento', v.empreendimento
      ) AS item
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
    ) sub
  )
  SELECT jsonb_build_object(
    'sessao', jsonb_build_object(
      'id', v_sessao.id,
      'status', v_sessao.status,
      'inicio_at', v_sessao.inicio_at,
      'fim_at', v_sessao.fim_at,
      'data', v_sessao.data
    ),
    'corretores', COALESCE((SELECT arr FROM corretores), '[]'::jsonb),
    'equipes', COALESCE((SELECT arr FROM equipes), '[]'::jsonb),
    'feed', COALESCE((SELECT arr FROM feed), '[]'::jsonb),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_placar_mutirao(uuid) TO anon, authenticated, service_role;