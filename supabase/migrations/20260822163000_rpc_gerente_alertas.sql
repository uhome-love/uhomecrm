-- Cockpit do gerente · Alertas do time (fonte única, escopo do gerente).
-- Duas prioridades além do pós-visita:
--  1) negocios_risco: negócios em negociação/contrato ativos, por VGV, com dias parados
--     (é onde as propostas somem — surface o Lake Eyre e cia. pro gerente empurrar).
--  2) corretores_sem_acao: corretores do time com leads em atendimento SEM próxima ação
--     marcada (o sinal de "sem organização"), + leads sem contato.
-- Mesmo padrão da get_dashboard_gerente_cockpit (SECURITY DEFINER + team_members).
CREATE OR REPLACE FUNCTION public.get_gerente_alertas()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_neg jsonb;
  v_cor jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_role(v_uid,'gestor') OR public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretor')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH team AS (
    SELECT tm.user_id AS corretor, p.nome
    FROM team_members tm LEFT JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.gerente_id = v_uid AND tm.status = 'ativo' AND tm.user_id IS NOT NULL
  )
  SELECT
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'negocio_id', x.id, 'cliente', x.nome_cliente, 'empreendimento', x.empreendimento,
        'corretor', x.corretor, 'vgv', x.vgv, 'situacao', x.negociacao_situacao,
        'dias_parado', x.dias, 'lead_id', x.pipeline_lead_id
      ) ORDER BY x.vgv DESC NULLS LAST), '[]'::jsonb)
     FROM (
       SELECT n.id, n.nome_cliente, n.empreendimento, t.nome AS corretor,
         COALESCE(n.vgv_final, n.vgv_estimado) AS vgv, n.negociacao_situacao, n.pipeline_lead_id,
         GREATEST(0, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - n.updated_at::date)) AS dias
       FROM negocios n JOIN team t ON t.corretor = n.auth_user_id
       WHERE n.status = 'ativo' AND n.fase IN ('em_negociacao','contrato')
       ORDER BY vgv DESC NULLS LAST
       LIMIT 15
     ) x),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'corretor', y.nome, 'sem_proxima', y.sem_proxima, 'sem_contato', y.sem_contato
      ) ORDER BY y.sem_proxima DESC), '[]'::jsonb)
     FROM (
       SELECT t.nome,
         count(*) FILTER (WHERE pl.data_proxima_acao IS NULL AND ps.tipo IN ('qualificacao','aquecimento','visita','pos_visita','proposta')) AS sem_proxima,
         count(*) FILTER (WHERE ps.tipo IN ('sem_contato','novo_lead')) AS sem_contato
       FROM team t
       LEFT JOIN pipeline_leads pl ON pl.corretor_id = t.corretor AND pl.arquivado = false
       LEFT JOIN pipeline_stages ps ON ps.id = pl.stage_id
       GROUP BY t.nome
       HAVING count(*) FILTER (WHERE pl.data_proxima_acao IS NULL AND ps.tipo IN ('qualificacao','aquecimento','visita','pos_visita','proposta')) > 0
       ORDER BY sem_proxima DESC
       LIMIT 12
     ) y)
  INTO v_neg, v_cor;

  RETURN jsonb_build_object(
    'negocios_risco', COALESCE(v_neg, '[]'::jsonb),
    'corretores_sem_acao', COALESCE(v_cor, '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_gerente_alertas() TO authenticated;
