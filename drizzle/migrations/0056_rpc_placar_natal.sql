CREATE OR REPLACE FUNCTION public.rpc_placar_natal()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  seg AS (SELECT d - ((EXTRACT(ISODOW FROM d)::int) - 1) AS s, d FROM hoje),
  fim AS (SELECT LEAST(d, DATE '2026-12-18') AS f FROM hoje),
  eq AS (
    SELECT v.equipe, SUM(v.vgv_rateado) AS vgv
    FROM v_fato_venda v, fim
    WHERE v.data_assinatura BETWEEN DATE '2026-11-02' AND fim.f
      AND v.equipe IS NOT NULL AND v.equipe <> 'Sem equipe'
    GROUP BY v.equipe
  ),
  top AS (
    SELECT vi.corretor_auth_id,
           split_part(trim(max(vi.corretor_nome)), ' ', 1) ||
             CASE WHEN array_length(regexp_split_to_array(trim(max(vi.corretor_nome)), '\s+'), 1) > 1
                  THEN ' ' || left((regexp_split_to_array(trim(max(vi.corretor_nome)), '\s+'))[array_length(regexp_split_to_array(trim(max(vi.corretor_nome)), '\s+'), 1)], 1) || '.'
                  ELSE '' END AS nome,
           max(vi.equipe) AS equipe,
           COUNT(*) AS n
    FROM v_fato_visita vi, seg
    WHERE vi.conta_realizada AND vi.data_visita BETWEEN seg.s AND seg.d AND vi.corretor_auth_id IS NOT NULL
    GROUP BY vi.corretor_auth_id
    ORDER BY n DESC, nome
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'vgv_ano', COALESCE((SELECT SUM(v.vgv_rateado) FROM v_fato_venda v, hoje
                         WHERE v.data_assinatura BETWEEN DATE '2026-01-01' AND hoje.d), 0),
    'equipes', COALESCE((SELECT jsonb_agg(jsonb_build_object('equipe', equipe, 'vgv', vgv) ORDER BY vgv DESC) FROM eq), '[]'::jsonb),
    'top_semana', COALESCE((SELECT jsonb_agg(jsonb_build_object('nome', nome, 'equipe', equipe, 'n', n) ORDER BY n DESC, nome) FROM top), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_placar_natal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_placar_natal() TO anon, authenticated, service_role;