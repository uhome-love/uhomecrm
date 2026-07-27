CREATE OR REPLACE FUNCTION public.rpc_placar_do_dia()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio timestamptz := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_fim timestamptz := v_inicio + interval '1 day';
  v_result jsonb;
BEGIN
  WITH membros AS (
    SELECT user_id, gerente_id, nome
    FROM public.team_members
    WHERE status = 'ativo' AND user_id IS NOT NULL
  ),
  visitas_marcadas AS (
    SELECT v.id, v.corretor_id, v.created_at AS evento_em, v.created_at,
           v.status, v.nome_cliente, v.data_visita, v.empreendimento,
           m.nome AS corretor_nome, m.gerente_id
    FROM public.visitas v
    JOIN membros m ON m.user_id = v.corretor_id
    WHERE v.created_at >= v_inicio
      AND v.created_at < v_fim
      AND COALESCE(v.origem, 'manual') NOT LIKE 'backfill_%'
      AND COALESCE(v.origem, 'manual') <> 'auto_stage_move'
  ),
  eventos_realizacao AS (
    SELECT DISTINCT ON (e.visita_id)
           e.visita_id, e.created_at AS evento_em
    FROM public.visita_eventos e
    WHERE e.created_at >= v_inicio
      AND e.created_at < v_fim
      AND e.status_novo = 'realizada'
      AND e.tipo IN ('status_alterado', 'criada')
    ORDER BY e.visita_id, e.created_at ASC
  ),
  visitas_realizadas AS (
    SELECT v.id, v.corretor_id, er.evento_em, v.created_at,
           v.status, v.nome_cliente, v.data_visita, v.empreendimento,
           m.nome AS corretor_nome, m.gerente_id
    FROM eventos_realizacao er
    JOIN public.visitas v ON v.id = er.visita_id
    JOIN membros m ON m.user_id = v.corretor_id
    WHERE COALESCE(v.origem, 'manual') NOT LIKE 'backfill_%'
      AND COALESCE(v.origem, 'manual') <> 'auto_stage_move'
  )
  SELECT jsonb_build_object(
    'membros',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'gerente_id', gerente_id, 'nome', nome
      )), '[]'::jsonb) FROM membros),
    'visitas_marcadas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vm) ORDER BY vm.evento_em DESC), '[]'::jsonb)
       FROM visitas_marcadas vm),
    'visitas_realizadas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vr) ORDER BY vr.evento_em DESC), '[]'::jsonb)
       FROM visitas_realizadas vr),
    'visitas',
      (SELECT COALESCE(jsonb_agg(to_jsonb(vm) ORDER BY vm.evento_em DESC), '[]'::jsonb)
       FROM visitas_marcadas vm),
    'gerado_em', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_placar_do_dia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_placar_do_dia() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_pos_visita_garante_visita_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_visita_id uuid := '72e0ffb4-396e-457d-8235-13f018408ff1';
  v_has_realizada boolean;
BEGIN
  IF NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN RETURN NEW; END IF;
  IF NEW.stage_id <> v_pos_visita_id THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.visitas
    WHERE pipeline_lead_id = NEW.id
      AND status = 'realizada'
      AND COALESCE(origem, 'manual') NOT LIKE 'backfill_%'
      AND COALESCE(origem, 'manual') <> 'auto_stage_move'
  ) INTO v_has_realizada;

  IF NOT v_has_realizada AND NEW.corretor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.pipeline_tarefas
    WHERE pipeline_lead_id = NEW.id
      AND origem = 'pos_visita_inconsistencia'
      AND status = 'pendente'
  ) THEN
    INSERT INTO public.pipeline_tarefas (
      pipeline_lead_id, titulo, descricao, prioridade, status,
      responsavel_id, vence_em, hora_vencimento, created_by,
      tipo, origem, subtipo
    ) VALUES (
      NEW.id,
      'Regularizar visita do Pós-Visita',
      'O lead entrou em Pós-Visita sem uma visita realizada comprovada. Registre a visita correta na agenda ou revise a etapa do lead.',
      'alta', 'pendente', NEW.corretor_id,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      '18:00'::time, NEW.corretor_id,
      'follow_up', 'pos_visita_inconsistencia', 'regularizar_visita'
    );
  END IF;

  RETURN NEW;
END;
$$;