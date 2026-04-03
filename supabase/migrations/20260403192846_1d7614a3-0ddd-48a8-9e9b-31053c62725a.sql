
-- Reset distribuicao_historico counts for today to rebalance
-- Delete excess entries for Ebert and Taynah to bring them in line with average (5 each)
-- Ebert has 18, delete 13 oldest
-- Taynah has 17, delete 12 oldest
-- Thalia has 8, delete 3

DELETE FROM public.distribuicao_historico
WHERE id IN (
  -- Ebert: keep 5, delete 13
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = 'cc857f25-c7ba-4191-8d1a-b4b6cebfed9c'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 13
  UNION ALL
  -- Taynah: keep 5, delete 12
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = 'b473388d-a660-487c-999c-16dee0f19f80'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 12
  UNION ALL
  -- Thalia: keep 5, delete 3
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = 'c882b90d-462e-441d-9b11-77424931628c'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 3
  UNION ALL
  -- Matheus: keep 5, delete 2
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = '00a26f80-a466-43bd-977f-227d1440efb5'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 2
  UNION ALL
  -- Jessica: keep 5, delete 2
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = 'c988f004-69d5-4db4-8aed-3e18807b69fd'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 2
  UNION ALL
  -- Junior: keep 5, delete 1
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM public.distribuicao_historico
    WHERE corretor_id = '7a270cc1-a457-4a02-8a62-462ba5a98937'
      AND acao = 'distribuido'
      AND created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
  ) sub WHERE rn <= 1
);

-- Also deduplicate roleta_fila - keep only one row per corretor per day
DELETE FROM public.roleta_fila
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY corretor_id, data ORDER BY leads_recebidos DESC) as rn
    FROM public.roleta_fila
    WHERE data = '2026-04-03'
  ) sub WHERE rn > 1
);

-- Reset all roleta_fila counters to actual distribuicao_historico counts
UPDATE public.roleta_fila rf
SET leads_recebidos = COALESCE((
  SELECT COUNT(*)
  FROM public.distribuicao_historico dh
  JOIN public.profiles p ON p.id = rf.corretor_id
  WHERE dh.corretor_id = p.user_id
    AND dh.acao = 'distribuido'
    AND dh.created_at >= '2026-04-03'::date AT TIME ZONE 'America/Sao_Paulo'
), 0)
WHERE rf.data = '2026-04-03';
