CREATE TABLE public.roleta_fechamento_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_inicio date NOT NULL,
  corretor_id uuid NOT NULL,
  gerente_id uuid,
  visitas_validas integer NOT NULL DEFAULT 0,
  crm_pct numeric,
  situacao text NOT NULL,
  um_a_um_pendente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semana_inicio, corretor_id)
);
GRANT SELECT ON public.roleta_fechamento_semanal TO authenticated;
GRANT ALL ON public.roleta_fechamento_semanal TO service_role;
ALTER TABLE public.roleta_fechamento_semanal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fechamento_select" ON public.roleta_fechamento_semanal FOR SELECT TO authenticated
USING (
  corretor_id = auth.uid()
  OR gerente_id = auth.uid()
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
);
CREATE INDEX idx_fechamento_semana ON public.roleta_fechamento_semanal (semana_inicio, gerente_id);

CREATE OR REPLACE FUNCTION public.roleta_fechar_semana(p_semana_inicio date DEFAULT NULL, p_notificar boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_meta int := public.roleta_visitas_meta();
  r record; v_vis int; v_pct numeric; v_sit text; v_n int := 0; g record; v_label text;
BEGIN
  v_ini := COALESCE(p_semana_inicio, v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::int) - 1) - 7);
  v_fim := v_ini + 6;
  v_label := to_char(v_ini,'DD') || '–' || to_char(v_fim,'DD/MM');
  FOR r IN SELECT DISTINCT ON (tm.user_id) tm.user_id, tm.gerente_id FROM public.team_members tm
           WHERE tm.status = 'ativo' AND tm.user_id IS NOT NULL AND tm.user_id <> tm.gerente_id
           ORDER BY tm.user_id, tm.updated_at DESC LOOP
    BEGIN
      v_vis := COALESCE(public.roleta_visitas_realizadas_periodo(r.user_id, v_ini, v_fim), 0);
      v_pct := (public.crm_saude_corretor(r.user_id)->>'pct')::numeric;
      v_sit := CASE WHEN v_vis >= v_meta THEN 'apto' WHEN v_vis >= 1 THEN 'evolucao' ELSE 'retomada' END;
      INSERT INTO public.roleta_fechamento_semanal (semana_inicio, corretor_id, gerente_id, visitas_validas, crm_pct, situacao, um_a_um_pendente)
      VALUES (v_ini, r.user_id, r.gerente_id, v_vis, round(v_pct,1), v_sit, v_sit = 'retomada')
      ON CONFLICT (semana_inicio, corretor_id) DO NOTHING;
      IF FOUND THEN
        v_n := v_n + 1;
        IF p_notificar THEN
          PERFORM public.criar_notificacao(r.user_id, 'performance', 'fechamento_semanal',
            '📊 Fechamento da semana ' || v_label,
            'Você fez ' || v_vis || ' visita' || CASE WHEN v_vis = 1 THEN '' ELSE 's' END || ' válida' || CASE WHEN v_vis = 1 THEN '' ELSE 's' END || '. Situação: ' ||
              CASE v_sit WHEN 'apto' THEN 'Apto' WHEN 'evolucao' THEN 'Em evolução' ELSE 'Plano de retomada' END || '.',
            jsonb_build_object('semana_inicio', v_ini, 'situacao', v_sit, 'visitas', v_vis),
            'fechamento_' || v_ini::text || '_' || r.user_id::text);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  IF p_notificar THEN
    FOR g IN SELECT gerente_id, count(*) FILTER (WHERE situacao='apto') a, count(*) FILTER (WHERE situacao='evolucao') e, count(*) FILTER (WHERE situacao='retomada') rt
             FROM public.roleta_fechamento_semanal WHERE semana_inicio = v_ini AND gerente_id IS NOT NULL GROUP BY gerente_id LOOP
      BEGIN
        PERFORM public.criar_notificacao(g.gerente_id, 'performance', 'fechamento_semanal_equipe',
          '📊 Fechamento da semana ' || v_label,
          g.a || ' aptos, ' || g.e || ' em evolução, ' || g.rt || ' em plano de retomada (1:1 obrigatório).',
          jsonb_build_object('semana_inicio', v_ini),
          'fechamento_equipe_' || v_ini::text || '_' || g.gerente_id::text);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;
  RETURN v_n;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.roleta_fechar_semana(date, boolean) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('roleta-fechamento-semanal', '5 3 * * 1', $$ SELECT public.roleta_fechar_semana(); $$);