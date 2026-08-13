-- Dashboard do Gerente (Cockpit) — RPC escopo do gerente (auth.uid()), fonte única.
-- Retorna meta, presença, resultado do mês, saúde dos leads, visitas, funil e
-- corretores ranqueados do time. Saúde via public.lead_saude_status.
-- Já aplicada em produção em 12/08/2026; este arquivo mantém o repo como fonte.

CREATE OR REPLACE FUNCTION public.get_dashboard_gerente_cockpit()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_mes text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
  v_mstart date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'gestor') OR public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  WITH team AS (
    SELECT tm.user_id AS corretor, p.id AS profile_id, p.nome
    FROM team_members tm LEFT JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.gerente_id = v_uid AND tm.status='ativo' AND tm.user_id IS NOT NULL),
  leads AS (
    SELECT pl.id, pl.corretor_id, ps.tipo,
      (pl.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS criado,
      public.lead_saude_status(pl.ultimo_toque_at, COALESCE(pl.distribuido_em, pl.aceito_em, pl.created_at), ps.tipo) AS saude
    FROM pipeline_leads pl JOIN team t ON t.corretor = pl.corretor_id
    JOIN pipeline_stages ps ON ps.id = pl.stage_id WHERE pl.arquivado=false),
  ativos AS (SELECT * FROM leads WHERE tipo NOT IN ('descarte','convertido','venda')),
  vis AS (SELECT vu.corretor_id, vu.status FROM visitas_unicas vu JOIN team t ON t.corretor=vu.corretor_id
    WHERE vu.data_visita >= v_mstart AND vu.status <> 'cancelada'),
  vis_hoje AS (SELECT count(*) n FROM visitas_unicas vu JOIN team t ON t.corretor=vu.corretor_id
    WHERE vu.data_visita = v_today AND vu.status <> 'cancelada'),
  neg AS (SELECT n.id, n.fase, n.status, n.auth_user_id, COALESCE(n.vgv_final,n.vgv_estimado) AS vgv, n.data_assinatura
    FROM negocios n JOIN team t ON t.corretor = n.auth_user_id),
  vendas AS (SELECT * FROM neg WHERE fase='ganho' AND data_assinatura IS NOT NULL AND to_char(data_assinatura,'YYYY-MM')=v_mes),
  presenca AS (SELECT count(DISTINCT rp.corretor_id) n FROM roleta_presencas rp JOIN team t ON t.corretor=rp.corretor_id
    WHERE rp.data = v_today AND rp.chegou_em IS NOT NULL),
  corr AS (
    SELECT t.corretor, t.nome,
      (SELECT count(*) FROM leads l WHERE l.corretor_id=t.corretor AND l.criado >= v_mstart) AS leads_mes,
      (SELECT count(*) FROM vis v WHERE v.corretor_id=t.corretor) AS vis_total,
      (SELECT count(*) FROM vis v WHERE v.corretor_id=t.corretor AND v.status='realizada') AS vis_real,
      (SELECT count(*) FROM ativos a WHERE a.corretor_id=t.corretor AND a.tipo IN ('documentacao','proposta','contrato_gerado')) AS negocios,
      (SELECT count(*) FROM vendas ve WHERE ve.auth_user_id=t.corretor) AS vendas
    FROM team t)
  SELECT jsonb_build_object(
    'corretores_total', (SELECT count(*) FROM team),
    'presentes', (SELECT n FROM presenca),
    'meta', jsonb_build_object(
      'assinado', COALESCE((SELECT sum(vgv) FROM vendas),0),
      'meta', COALESCE((SELECT meta_vgv_assinado FROM ceo_metas_mensais WHERE gerente_id=v_uid AND mes=v_mes),0),
      'pipeline_ativo', COALESCE((SELECT sum(vgv) FROM neg WHERE status='ativo' AND fase<>'ganho'),0)),
    'resultado', jsonb_build_object(
      'vendas_count', (SELECT count(*) FROM vendas),
      'vendas_vgv', COALESCE((SELECT sum(vgv) FROM vendas),0),
      'leads_ativos', (SELECT count(*) FROM ativos),
      'leads_mes', (SELECT count(*) FROM leads WHERE criado >= v_mstart)),
    'saude', jsonb_build_object(
      'em_dia', (SELECT count(*) FROM ativos WHERE saude='verde'),
      'atencao', (SELECT count(*) FROM ativos WHERE saude='ambar'),
      'desatualizado', (SELECT count(*) FROM ativos WHERE saude='vermelho'),
      'estagnado', (SELECT count(*) FROM ativos WHERE saude='estagnado')),
    'visitas', jsonb_build_object(
      'total', (SELECT count(*) FROM vis),
      'realizadas', (SELECT count(*) FROM vis WHERE status='realizada'),
      'no_show', (SELECT count(*) FROM vis WHERE status='no_show'),
      'hoje', (SELECT n FROM vis_hoje)),
    'funil', jsonb_build_object(
      'pos_visita', (SELECT count(*) FROM ativos WHERE tipo='pos_visita'),
      'documentacao', (SELECT count(*) FROM ativos WHERE tipo='documentacao'),
      'proposta', (SELECT count(*) FROM ativos WHERE tipo='proposta'),
      'contrato', (SELECT count(*) FROM ativos WHERE tipo='contrato_gerado'),
      'ganho_mes', (SELECT count(*) FROM vendas)),
    'corretores', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'nome', c.nome, 'leads_mes', c.leads_mes, 'vis_total', c.vis_total, 'vis_real', c.vis_real,
        'negocios', c.negocios, 'vendas', c.vendas)
      ORDER BY c.vendas DESC, c.negocios DESC, c.vis_real DESC, c.leads_mes DESC) FROM corr c), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $function$;
