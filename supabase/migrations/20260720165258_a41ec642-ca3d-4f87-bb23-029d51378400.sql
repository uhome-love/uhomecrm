
-- =========================================================
-- 1) COLUNA ORIGEM
-- =========================================================
ALTER TABLE public.roleta_presencas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual_gestor';

-- Domínio de valores (aditivo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roleta_presencas_origem_check'
      AND conrelid = 'public.roleta_presencas'::regclass
  ) THEN
    ALTER TABLE public.roleta_presencas
      ADD CONSTRAINT roleta_presencas_origem_check
      CHECK (origem IN ('auto_credenciamento','manual_gestor','manual_ceo','sistema_fechamento','manual_corretor'));
  END IF;
END $$;

-- =========================================================
-- 2) TRIGGER: presença automática ao aprovar credenciamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.registrar_presenca_auto_credenciamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turnos text[];
  v_turno text;
BEGIN
  -- Mapeia janela -> turno(s) de roleta_presencas
  IF NEW.janela = 'dia_todo' THEN
    v_turnos := ARRAY['manha','tarde'];
  ELSIF NEW.janela IN ('manha','tarde','noturna') THEN
    v_turnos := ARRAY[NEW.janela];
  ELSE
    RETURN NEW; -- janela desconhecida, não faz nada
  END IF;

  FOREACH v_turno IN ARRAY v_turnos LOOP
    INSERT INTO public.roleta_presencas
      (corretor_id, data, turno, status, chegou_em, validado_por, validado_em, origem, observacao)
    VALUES
      (NEW.corretor_id, NEW.data, v_turno, 'na_empresa', now(), NEW.aprovado_por, now(),
       'auto_credenciamento', 'Presença registrada automaticamente pela aprovação do credenciamento')
    ON CONFLICT (corretor_id, data, turno) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presenca_auto_credenciamento ON public.roleta_credenciamentos;
CREATE TRIGGER trg_presenca_auto_credenciamento
AFTER UPDATE OF status ON public.roleta_credenciamentos
FOR EACH ROW
WHEN (NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado'))
EXECUTE FUNCTION public.registrar_presenca_auto_credenciamento();

-- Também dispara em INSERT direto com status='aprovado'
DROP TRIGGER IF EXISTS trg_presenca_auto_credenciamento_ins ON public.roleta_credenciamentos;
CREATE TRIGGER trg_presenca_auto_credenciamento_ins
AFTER INSERT ON public.roleta_credenciamentos
FOR EACH ROW
WHEN (NEW.status = 'aprovado')
EXECUTE FUNCTION public.registrar_presenca_auto_credenciamento();

-- =========================================================
-- 3) TRIGGER: sync "saiu" credenciamento -> presença
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_presenca_saiu_credenciamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turnos text[];
  v_turno text;
BEGIN
  IF NEW.janela = 'dia_todo' THEN
    v_turnos := ARRAY['manha','tarde'];
  ELSIF NEW.janela IN ('manha','tarde','noturna') THEN
    v_turnos := ARRAY[NEW.janela];
  ELSE
    RETURN NEW;
  END IF;

  FOREACH v_turno IN ARRAY v_turnos LOOP
    UPDATE public.roleta_presencas
       SET status = 'saiu',
           saiu_em = COALESCE(saiu_em, NEW.saiu_em, now()),
           updated_at = now()
     WHERE corretor_id = NEW.corretor_id
       AND data = NEW.data
       AND turno = v_turno
       AND status <> 'saiu';
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presenca_sync_saiu ON public.roleta_credenciamentos;
CREATE TRIGGER trg_presenca_sync_saiu
AFTER UPDATE OF status ON public.roleta_credenciamentos
FOR EACH ROW
WHEN (NEW.status = 'saiu' AND (OLD.status IS DISTINCT FROM 'saiu'))
EXECUTE FUNCTION public.sync_presenca_saiu_credenciamento();

-- =========================================================
-- 4) HELPER: escopo do caller
-- =========================================================
-- Retorna: 'admin' (vê tudo), 'gestor' (vê time), 'corretor' (só a si), 'none'
CREATE OR REPLACE FUNCTION public.presenca_role_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::app_role) THEN 'admin'
    WHEN public.has_role(_user_id, 'diretor'::app_role) THEN 'admin'
    WHEN public.has_role(_user_id, 'gestor'::app_role) THEN 'gestor'
    WHEN public.has_role(_user_id, 'corretor'::app_role) THEN 'corretor'
    ELSE 'none'
  END;
$$;

-- =========================================================
-- 5) RPC: presença de hoje (para tab Hoje)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_presenca_hoje(_data date DEFAULT NULL)
RETURNS TABLE (
  corretor_id uuid,
  auth_user_id uuid,
  nome text,
  avatar_url text,
  gerente_nome text,
  gerente_id uuid,
  turno text,
  status text,
  chegou_em timestamptz,
  saiu_em timestamptz,
  origem text,
  credenciado boolean,
  cred_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date := COALESCE(_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_scope text := public.presenca_role_scope(auth.uid());
BEGIN
  IF v_scope = 'none' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base_corretores AS (
    SELECT DISTINCT p.id AS corretor_id, p.user_id AS auth_user_id, p.nome, p.avatar_url
    FROM public.profiles p
    WHERE p.ativo IS DISTINCT FROM false
      AND p.cargo = 'corretor'
      AND (
        v_scope = 'admin'
        OR (
          v_scope = 'gestor'
          AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id = p.user_id
              AND tm.gerente_id = auth.uid()
              AND tm.status = 'ativo'
          )
        )
        OR (v_scope = 'corretor' AND p.user_id = auth.uid())
      )
  ),
  turnos AS (
    SELECT unnest(ARRAY['manha','tarde','noturna']) AS turno
  ),
  grade AS (
    SELECT bc.corretor_id, bc.auth_user_id, bc.nome, bc.avatar_url, t.turno
    FROM base_corretores bc CROSS JOIN turnos t
  )
  SELECT
    g.corretor_id,
    g.auth_user_id,
    g.nome,
    g.avatar_url,
    ger.nome AS gerente_nome,
    tm.gerente_id,
    g.turno,
    rp.status,
    rp.chegou_em,
    rp.saiu_em,
    rp.origem,
    (rc.id IS NOT NULL) AS credenciado,
    rc.status AS cred_status
  FROM grade g
  LEFT JOIN public.team_members tm
    ON tm.user_id = g.auth_user_id AND tm.status = 'ativo'
  LEFT JOIN public.profiles ger
    ON ger.user_id = tm.gerente_id
  LEFT JOIN public.roleta_presencas rp
    ON rp.corretor_id = g.corretor_id AND rp.data = v_data AND rp.turno = g.turno
  LEFT JOIN LATERAL (
    SELECT id, status FROM public.roleta_credenciamentos
    WHERE corretor_id = g.corretor_id
      AND data = v_data
      AND (janela = g.turno OR (janela = 'dia_todo' AND g.turno IN ('manha','tarde')))
      AND status IN ('aprovado','pendente','saiu')
    ORDER BY CASE status WHEN 'aprovado' THEN 1 WHEN 'pendente' THEN 2 ELSE 3 END
    LIMIT 1
  ) rc ON true
  ORDER BY g.nome, g.turno;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_presenca_hoje(date) TO authenticated;

-- =========================================================
-- 6) RPC: presença agregada por período (tab Histórico)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_presenca_agregada(
  _data_inicio date,
  _data_fim date,
  _gestor_id uuid DEFAULT NULL,
  _corretor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  corretor_id uuid,
  auth_user_id uuid,
  nome text,
  avatar_url text,
  gerente_nome text,
  manha int,
  tarde int,
  diurnas int,
  noturnas int,
  domingos int,
  faltas int,
  saidas int,
  dias_ativos int,
  total_presencas int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text := public.presenca_role_scope(auth.uid());
  v_gestor_filter uuid := _gestor_id;
  v_corretor_filter uuid := _corretor_id;
BEGIN
  IF v_scope = 'none' THEN
    RETURN;
  END IF;

  -- Força escopo: corretor só vê a si mesmo
  IF v_scope = 'corretor' THEN
    SELECT p.id INTO v_corretor_filter FROM public.profiles p WHERE p.user_id = auth.uid();
  END IF;

  -- Gestor só do próprio time
  IF v_scope = 'gestor' THEN
    v_gestor_filter := auth.uid();
  END IF;

  RETURN QUERY
  WITH base_corretores AS (
    SELECT p.id AS corretor_id, p.user_id AS auth_user_id, p.nome, p.avatar_url, tm.gerente_id
    FROM public.profiles p
    LEFT JOIN public.team_members tm ON tm.user_id = p.user_id AND tm.status = 'ativo'
    WHERE p.ativo IS DISTINCT FROM false
      AND p.cargo = 'corretor'
      AND (v_corretor_filter IS NULL OR p.id = v_corretor_filter)
      AND (v_gestor_filter IS NULL OR tm.gerente_id = v_gestor_filter)
  ),
  agr AS (
    SELECT
      rp.corretor_id,
      COUNT(*) FILTER (WHERE rp.turno='manha'   AND rp.status='na_empresa')::int AS manha,
      COUNT(*) FILTER (WHERE rp.turno='tarde'   AND rp.status='na_empresa')::int AS tarde,
      COUNT(*) FILTER (WHERE rp.turno IN ('manha','tarde') AND rp.status='na_empresa')::int AS diurnas,
      COUNT(*) FILTER (WHERE rp.turno='noturna' AND rp.status='na_empresa')::int AS noturnas,
      COUNT(*) FILTER (WHERE EXTRACT(DOW FROM rp.data)=0 AND rp.status='na_empresa')::int AS domingos,
      COUNT(*) FILTER (WHERE rp.status='falta')::int AS faltas,
      COUNT(*) FILTER (WHERE rp.status='saiu')::int  AS saidas,
      COUNT(DISTINCT rp.data) FILTER (WHERE rp.status='na_empresa')::int AS dias_ativos,
      COUNT(*) FILTER (WHERE rp.status='na_empresa')::int AS total_presencas
    FROM public.roleta_presencas rp
    WHERE rp.data BETWEEN _data_inicio AND _data_fim
    GROUP BY rp.corretor_id
  )
  SELECT
    bc.corretor_id, bc.auth_user_id, bc.nome, bc.avatar_url,
    ger.nome AS gerente_nome,
    COALESCE(a.manha,0), COALESCE(a.tarde,0), COALESCE(a.diurnas,0),
    COALESCE(a.noturnas,0), COALESCE(a.domingos,0),
    COALESCE(a.faltas,0), COALESCE(a.saidas,0),
    COALESCE(a.dias_ativos,0), COALESCE(a.total_presencas,0)
  FROM base_corretores bc
  LEFT JOIN agr a ON a.corretor_id = bc.corretor_id
  LEFT JOIN public.profiles ger ON ger.user_id = bc.gerente_id
  ORDER BY COALESCE(a.total_presencas,0) DESC, bc.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_presenca_agregada(date, date, uuid, uuid) TO authenticated;

-- =========================================================
-- 7) RPC: widget produtividade do corretor
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_widget_corretor_semana(
  _corretor_id uuid DEFAULT NULL,
  _periodo text DEFAULT 'semana'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text := public.presenca_role_scope(auth.uid());
  v_corretor_id uuid := _corretor_id;
  v_auth_user uuid;
  v_gestor uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini date;
  v_fim date;
  v_ini_prev date;
  v_fim_prev date;
  v_presencas int;
  v_presencas_prev int;
  v_leads int;
  v_negocios int;
  v_media_p numeric;
  v_media_l numeric;
  v_time_size int;
BEGIN
  -- Corretor força sempre a si
  IF v_scope = 'corretor' OR v_corretor_id IS NULL THEN
    SELECT p.id, p.user_id INTO v_corretor_id, v_auth_user
    FROM public.profiles p WHERE p.user_id = auth.uid();
  ELSE
    SELECT p.user_id INTO v_auth_user FROM public.profiles p WHERE p.id = v_corretor_id;
  END IF;

  IF v_corretor_id IS NULL THEN
    RETURN jsonb_build_object('error','no_corretor');
  END IF;

  -- Descobre gestor do corretor
  SELECT tm.gerente_id INTO v_gestor
  FROM public.team_members tm
  WHERE tm.user_id = v_auth_user AND tm.status = 'ativo'
  LIMIT 1;

  -- Janelas
  IF _periodo = 'mes' THEN
    v_ini := date_trunc('month', v_hoje)::date;
    v_fim := v_hoje;
    v_ini_prev := (date_trunc('month', v_hoje) - interval '1 month')::date;
    v_fim_prev := (date_trunc('month', v_hoje) - interval '1 day')::date;
  ELSE
    -- semana: segunda a hoje
    v_ini := (v_hoje - ((EXTRACT(ISODOW FROM v_hoje))::int - 1));
    v_fim := v_hoje;
    v_ini_prev := v_ini - 7;
    v_fim_prev := v_ini - 1;
  END IF;

  -- Presenças do corretor
  SELECT COUNT(*) FILTER (WHERE status='na_empresa') INTO v_presencas
  FROM public.roleta_presencas
  WHERE corretor_id = v_corretor_id AND data BETWEEN v_ini AND v_fim;

  SELECT COUNT(*) FILTER (WHERE status='na_empresa') INTO v_presencas_prev
  FROM public.roleta_presencas
  WHERE corretor_id = v_corretor_id AND data BETWEEN v_ini_prev AND v_fim_prev;

  -- Leads recebidos (roleta_distribuicoes)
  BEGIN
    EXECUTE format(
      'SELECT COUNT(*) FROM public.roleta_distribuicoes
        WHERE corretor_id = $1 AND created_at::date BETWEEN $2 AND $3'
    ) INTO v_leads USING v_corretor_id, v_ini, v_fim;
  EXCEPTION WHEN OTHERS THEN v_leads := 0;
  END;

  -- Negócios criados (negocios.corretor_id = profiles.id conforme memória)
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM public.negocios
             WHERE corretor_id = $1 AND created_at::date BETWEEN $2 AND $3'
    INTO v_negocios USING v_corretor_id, v_ini, v_fim;
  EXCEPTION WHEN OTHERS THEN v_negocios := 0;
  END;

  -- Média do time (mesmo gestor)
  IF v_gestor IS NOT NULL THEN
    WITH time_c AS (
      SELECT p.id AS cid
      FROM public.profiles p
      JOIN public.team_members tm ON tm.user_id = p.user_id AND tm.status='ativo'
      WHERE tm.gerente_id = v_gestor AND p.cargo='corretor' AND p.ativo IS DISTINCT FROM false
    ),
    p_c AS (
      SELECT tc.cid,
             COUNT(*) FILTER (WHERE rp.status='na_empresa') AS pres
      FROM time_c tc
      LEFT JOIN public.roleta_presencas rp
        ON rp.corretor_id = tc.cid AND rp.data BETWEEN v_ini AND v_fim
      GROUP BY tc.cid
    ),
    l_c AS (
      SELECT tc.cid, COALESCE((
        SELECT COUNT(*) FROM public.roleta_distribuicoes rd
        WHERE rd.corretor_id = tc.cid AND rd.created_at::date BETWEEN v_ini AND v_fim
      ),0) AS leads
      FROM time_c tc
    )
    SELECT COUNT(*), AVG(p_c.pres)::numeric, AVG(l_c.leads)::numeric
    INTO v_time_size, v_media_p, v_media_l
    FROM p_c JOIN l_c USING (cid);
  END IF;

  RETURN jsonb_build_object(
    'periodo', _periodo,
    'inicio', v_ini,
    'fim', v_fim,
    'presencas', COALESCE(v_presencas,0),
    'presencas_prev', COALESCE(v_presencas_prev,0),
    'leads', COALESCE(v_leads,0),
    'negocios', COALESCE(v_negocios,0),
    'media_time_presencas', COALESCE(round(v_media_p,1), 0),
    'media_time_leads', COALESCE(round(v_media_l,1), 0),
    'time_size', COALESCE(v_time_size,0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_widget_corretor_semana(uuid, text) TO authenticated;

-- =========================================================
-- 8) POLICIES em roleta_presencas — refinar SELECT por escopo
-- =========================================================
DROP POLICY IF EXISTS "Authenticated read roleta_presencas" ON public.roleta_presencas;

CREATE POLICY "Presenca select por escopo"
ON public.roleta_presencas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR (
    public.has_role(auth.uid(), 'gestor'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.team_members tm ON tm.user_id = p.user_id AND tm.status='ativo'
      WHERE p.id = roleta_presencas.corretor_id
        AND tm.gerente_id = auth.uid()
    )
  )
  OR (
    public.has_role(auth.uid(), 'corretor'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = roleta_presencas.corretor_id AND p.user_id = auth.uid()
    )
  )
);
