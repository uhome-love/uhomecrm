-- ============================================================
-- Lote 4a — correção de dados de vendas + VGV assinado único
-- ============================================================

-- Parte 1.1 — reativar 4 vendas legítimas arquivadas
UPDATE negocios SET status='ativo', updated_at=now()
WHERE id IN (
  '415e0f68-f5d2-4fc0-99a0-cb5bc706a7c0',
  '1bde3760-d479-42d8-b55a-4513abd3f8f4',
  'ec2ca15c-ad99-48a8-a44f-0e33e5d4a3db',
  '9911c4df-51d7-4c05-bddd-0431ce7b5ca1'
) AND status='arquivado';

-- Parte 1.2 — desistência após assinatura
UPDATE negocios SET status='perdido', motivo_queda='Desistência após assinatura', updated_at=now()
WHERE id='c4f6ec9e-334d-4e0d-9f38-517a95bf55f5' AND status='arquivado';

-- Parte 1.3 — inserir Hola 1114 (idempotente)
INSERT INTO negocios (id, nome_cliente, empreendimento, unidade, fase, status,
  vgv_estimado, vgv_final, data_assinatura, corretor_id, gerente_id, auth_user_id,
  equipe_gerente_auth_id, origem, created_at, updated_at)
SELECT gen_random_uuid(), 'Fernando', 'Hola', '1114', 'ganho', 'ativo',
  334000, 334000, '2026-01-05',
  '6a0e1357-8c52-4b83-9dc0-7d9353869c57',
  '12da96bd-7b3a-4955-9135-b8ec94b29eb7',
  '00a26f80-a466-43bd-977f-227d1440efb5',
  '7882d73e-ff5c-4b23-9b08-2adeadcd1800',
  'planilha_auditoria', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM negocios WHERE nome_cliente='Fernando' AND empreendimento='Hola' AND unidade='1114'
);

-- ============================================================
-- Parte 2 — alinhar as 6 RPCs à definição única
-- Cada função é recriada a partir da própria definição atual,
-- alterando apenas as linhas de agregação de vendas assinadas.
-- ============================================================
DO $lote4a$
DECLARE d text; o text;
BEGIN
  -- 1) _kpi_team_window_core
  d := pg_get_functiondef('public._kpi_team_window_core(uuid[],uuid[],date,date,date,date,boolean)'::regprocedure);
  o := d;
  d := replace(d, 'WHERE n.fase = ''ganho'' AND n.data_assinatura BETWEEN p_start AND p_end',
                  'WHERE n.fase = ''ganho'' AND n.status = ''ativo'' AND n.data_assinatura BETWEEN p_start AND p_end');
  d := replace(d, 'AND fase = ''ganho'' AND data_assinatura BETWEEN p_start AND p_end;',
                  'AND fase = ''ganho'' AND status = ''ativo'' AND data_assinatura BETWEEN p_start AND p_end;');
  d := replace(d, 'AND fase = ''ganho'' AND data_assinatura BETWEEN p_prev_start AND p_prev_end;',
                  'AND fase = ''ganho'' AND status = ''ativo'' AND data_assinatura BETWEEN p_prev_start AND p_prev_end;');
  IF d <> o THEN EXECUTE d; END IF;

  -- 2) rpc_perf_dashboard
  d := pg_get_functiondef('public.rpc_perf_dashboard(date,date)'::regprocedure);
  o := d;
  d := replace(d, 'AND n.data_assinatura BETWEEN p_inicio AND p_fim',
                  'AND n.status = ''ativo''
       AND n.data_assinatura BETWEEN p_inicio AND p_fim');
  IF d <> o THEN EXECUTE d; END IF;

  -- 3) get_relatorio_vendas
  d := pg_get_functiondef('public.get_relatorio_vendas(uuid,date,date,date,date)'::regprocedure);
  o := d;
  d := replace(d, 'AND n.data_assinatura BETWEEN p_start AND p_end',
                  'AND n.fase = ''ganho'' AND n.status = ''ativo'' AND n.data_assinatura BETWEEN p_start AND p_end');
  d := replace(d, 'AND data_assinatura BETWEEN p_start AND p_end',
                  'AND fase = ''ganho'' AND status = ''ativo'' AND data_assinatura BETWEEN p_start AND p_end');
  IF d <> o THEN EXECUTE d; END IF;

  -- 4) get_dashboard_gerente (ON do LEFT JOIN primeiro, depois os WHERE)
  d := pg_get_functiondef('public.get_dashboard_gerente(uuid,text)'::regprocedure);
  o := d;
  d := replace(d, 'LEFT JOIN negocios n ON n.corretor_id = p.profile_id
     AND n.data_assinatura',
                  'LEFT JOIN negocios n ON n.corretor_id = p.profile_id
     AND n.fase = ''ganho'' AND n.status = ''ativo''
     AND n.data_assinatura');
  d := replace(d, 'WHERE n.data_assinatura BETWEEN v_',
                  'WHERE n.fase = ''ganho'' AND n.status = ''ativo'' AND n.data_assinatura BETWEEN v_');
  IF d <> o THEN EXECUTE d; END IF;

  -- 5) get_dashboard_gerente_v4_kpis
  d := pg_get_functiondef('public.get_dashboard_gerente_v4_kpis(uuid,text)'::regprocedure);
  o := d;
  d := replace(d, 'AND n.data_assinatura BETWEEN v_',
                  'AND n.fase = ''ganho'' AND n.status = ''ativo'' AND n.data_assinatura BETWEEN v_');
  IF d <> o THEN EXECUTE d; END IF;

  -- 6) get_ranking_central
  d := pg_get_functiondef('public.get_ranking_central(uuid,date,date)'::regprocedure);
  o := d;
  d := replace(d, 'AND data_assinatura BETWEEN p_start AND p_end',
                  'AND fase = ''ganho'' AND status = ''ativo'' AND data_assinatura BETWEEN p_start AND p_end');
  IF d <> o THEN EXECUTE d; END IF;
END
$lote4a$;