
-- 1) aceitar_lead: força arquivado=false e mantém proteção de expiração
CREATE OR REPLACE FUNCTION public.aceitar_lead(p_lead_id uuid, p_corretor_id uuid, p_status_inicial text DEFAULT 'ligando_agora'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_now timestamptz := now();
  v_novo_lead_stage_id uuid := 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019';
BEGIN
  SELECT id, corretor_id, aceite_status, aceite_expira_em
  INTO v_lead
  FROM pipeline_leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_found');
  END IF;

  IF v_lead.corretor_id IS DISTINCT FROM p_corretor_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_your_lead');
  END IF;

  IF v_lead.aceite_status NOT IN ('pendente', 'aguardando_aceite', 'pendente_aceite') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_pending', 'current_status', v_lead.aceite_status);
  END IF;

  -- Bloqueio rígido: sem aceite_expira_em OU expirado (com 30s de tolerância) = não aceita
  IF v_lead.aceite_expira_em IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sla_expired');
  END IF;

  IF v_lead.aceite_expira_em < (v_now - interval '30 seconds') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'sla_expired');
  END IF;

  UPDATE pipeline_leads
  SET aceite_status = 'aceito',
      aceito_em = v_now,
      stage_id = v_novo_lead_stage_id,
      arquivado = false,            -- garante visibilidade no pipeline
      arquivado_em = NULL,
      arquivado_motivo = NULL,
      updated_at = v_now
  WHERE id = p_lead_id;

  UPDATE roleta_distribuicoes
  SET status = 'aceito', aceito_em = v_now
  WHERE lead_id = p_lead_id AND status = 'aguardando';

  INSERT INTO distribuicao_historico (pipeline_lead_id, corretor_id, acao, tempo_resposta_seg)
  VALUES (
    p_lead_id,
    p_corretor_id,
    'aceito',
    EXTRACT(EPOCH FROM (v_now - COALESCE(v_lead.aceite_expira_em - interval '10 minutes', v_now)))::int
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2) expirar_aceites_roleta: notifica o corretor que perdeu o lead
CREATE OR REPLACE FUNCTION public.expirar_aceites_roleta()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT := 0;
  v_lead RECORD;
  v_lead_nome TEXT;
  v_lead_emp TEXT;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.corretor_id, pl.nome, pl.empreendimento
    FROM public.pipeline_leads pl
    WHERE pl.aceite_status = 'aguardando_aceite'
      AND pl.aceite_expira_em IS NOT NULL
      AND pl.aceite_expira_em < (now() - interval '30 seconds')
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.roleta_distribuicoes
       SET status = 'expirado'
     WHERE lead_id = v_lead.id AND status = 'aguardando';

    -- Notifica o corretor que perdeu o lead (antes de limpar corretor_id)
    IF v_lead.corretor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
      VALUES (
        v_lead.corretor_id,
        'lead',
        'lead_expirado',
        '⏰ Lead perdido por expiração',
        'Você perdeu o lead ' || COALESCE(v_lead.nome, 'sem nome')
          || COALESCE(' — ' || v_lead.empreendimento, '')
          || '. O tempo de 10 minutos para aceitar expirou e ele voltou para a fila.',
        jsonb_build_object(
          'pipeline_lead_id', v_lead.id,
          'lead_nome', v_lead.nome,
          'empreendimento', v_lead.empreendimento,
          'motivo', 'sla_expirado'
        ),
        'lead_expirado_' || v_lead.id::text
      );
    END IF;

    UPDATE public.pipeline_leads
       SET aceite_status = 'pendente_distribuicao',
           corretor_id   = NULL,
           distribuido_em = NULL,
           aceite_expira_em = NULL,
           updated_at = now()
     WHERE id = v_lead.id;

    INSERT INTO public.distribuicao_historico (pipeline_lead_id, corretor_id, acao, motivo_rejeicao, created_at)
    VALUES (v_lead.id, v_lead.corretor_id, 'timeout', 'sla_expirado', now());

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_count, 'at', now());
END;
$function$;
