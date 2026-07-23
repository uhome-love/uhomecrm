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
           COALESCE(part.pontos,0) AS pontos,
           COALESCE(part.ligacoes_count,0) AS ligacoes,
           COALESCE(part.aproveitamentos_count,0) AS aproveitamentos,
           COALESCE(part.visitas_count,0) AS visitas,
           part.status_online, part.ultima_acao_at,
           cp.nome, cp.avatar_url
      FROM public.oferta_ativa_participantes part
      JOIN corretor_profiles cp ON cp.profile_id = part.corretor_id
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_placar_mutirao(uuid) TO anon, authenticated, service_role;