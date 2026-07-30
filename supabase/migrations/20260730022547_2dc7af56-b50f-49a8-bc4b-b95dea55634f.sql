CREATE OR REPLACE FUNCTION public.rpc_metricas_detalhe(
  p_tipo text,
  p_start date,
  p_end date,
  p_user_id uuid DEFAULT NULL,
  p_gerente_id uuid DEFAULT NULL,
  p_limit int DEFAULT 300
)
RETURNS TABLE(
  id uuid,
  titulo text,
  subtitulo text,
  data_ref date,
  valor numeric,
  status text,
  corretor_nome text,
  equipe text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT * FROM (
    SELECT v.negocio_id AS id,
           COALESCE(v.nome_cliente, 'Sem nome') AS titulo,
           COALESCE(v.empreendimento, '—') AS subtitulo,
           v.data_assinatura AS data_ref,
           v.vgv_rateado AS valor,
           CASE WHEN v.em_parceria THEN 'parceria' ELSE 'venda' END AS status,
           v.corretor_nome, v.equipe
    FROM public.v_fato_venda v
    LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = v.corretor_auth_id
    WHERE p_tipo IN ('vendas','vgv')
      AND v.data_assinatura BETWEEN p_start AND p_end
      AND v.corretor_auth_id IS NOT NULL
      AND (p_user_id IS NULL OR v.corretor_auth_id = p_user_id)
      AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)

    UNION ALL

    SELECT vi.visita_id,
           COALESCE(vi.nome_cliente, 'Sem nome'),
           COALESCE(vi.empreendimento, '—'),
           COALESCE(vi.data_visita, vi.data_criacao),
           NULL::numeric,
           COALESCE(vi.resultado_visita, vi.status),
           vi.corretor_nome, vi.equipe
    FROM public.v_fato_visita vi
    LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = vi.corretor_auth_id
    WHERE vi.corretor_auth_id IS NOT NULL
      AND (p_user_id IS NULL OR vi.corretor_auth_id = p_user_id)
      AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)
      AND (
        (p_tipo = 'visitas_realizadas' AND vi.conta_realizada AND vi.data_visita BETWEEN p_start AND p_end)
        OR (p_tipo = 'visitas_no_show' AND vi.conta_no_show AND vi.data_visita BETWEEN p_start AND p_end)
        OR (p_tipo = 'visitas_marcadas' AND vi.conta_marcada AND vi.data_criacao BETWEEN p_start AND p_end)
      )

    UNION ALL

    SELECT l.lead_id,
           COALESCE(l.nome, 'Sem nome'),
           COALESCE(NULLIF(l.campanha, ''), NULLIF(l.origem, ''), '—'),
           l.data_entrada,
           NULL::numeric,
           COALESCE(l.stage_nome, '—'),
           l.corretor_nome, l.equipe
    FROM public.v_fato_lead l
    LEFT JOIN public.v_corretor_equipe ce ON ce.corretor_auth_id = l.corretor_auth_id
    WHERE p_tipo = 'leads'
      AND l.data_entrada BETWEEN p_start AND p_end
      AND l.corretor_auth_id IS NOT NULL
      AND (p_user_id IS NULL OR l.corretor_auth_id = p_user_id)
      AND (p_gerente_id IS NULL OR ce.gerente_auth_id = p_gerente_id)
  ) x
  ORDER BY x.data_ref DESC NULLS LAST, x.valor DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_metricas_detalhe(text, date, date, uuid, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_metricas_detalhe(text, date, date, uuid, uuid, int) TO service_role;