
CREATE OR REPLACE FUNCTION public.finalizar_trabalho_corretor(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_member record;
  v_checkpoint record;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day_start timestamptz := (v_today::text || 'T00:00:00-03:00')::timestamptz;
  v_day_end timestamptz := (v_today::text || 'T23:59:59.999-03:00')::timestamptz;
  v_ligacoes int := 0;
  v_aproveitados int := 0;
  v_whatsapps int := 0;
  v_emails int := 0;
  v_tentativas int := 0;
BEGIN
  SELECT tm.id, tm.gerente_id, tm.nome INTO v_team_member
  FROM team_members tm
  WHERE tm.user_id = p_user_id AND tm.status = 'ativo'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_linked', 'message', 'Corretor não vinculado a nenhum gerente.');
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE canal = 'ligacao'),
    COUNT(*) FILTER (WHERE canal = 'whatsapp'),
    COUNT(*) FILTER (WHERE canal = 'email'),
    COUNT(*) FILTER (WHERE resultado = 'com_interesse')
  INTO v_tentativas, v_ligacoes, v_whatsapps, v_emails, v_aproveitados
  FROM oferta_ativa_tentativas
  WHERE corretor_id = p_user_id
    AND created_at >= v_day_start
    AND created_at <= v_day_end;

  SELECT id INTO v_checkpoint
  FROM checkpoints
  WHERE gerente_id = v_team_member.gerente_id AND data = v_today;

  IF NOT FOUND THEN
    INSERT INTO checkpoints (gerente_id, data)
    VALUES (v_team_member.gerente_id, v_today)
    RETURNING id INTO v_checkpoint;
  END IF;

  INSERT INTO checkpoint_lines (checkpoint_id, corretor_id, real_ligacoes, real_leads)
  VALUES (v_checkpoint.id, v_team_member.id, v_tentativas, v_aproveitados)
  ON CONFLICT (checkpoint_id, corretor_id)
  DO UPDATE SET
    real_ligacoes = EXCLUDED.real_ligacoes,
    real_leads = EXCLUDED.real_leads,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'tentativas', v_tentativas,
    'ligacoes', v_ligacoes,
    'aproveitados', v_aproveitados,
    'gerente_id', v_team_member.gerente_id
  );
END;
$function$;
