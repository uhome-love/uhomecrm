CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_user_id uuid,
  p_tipo text,
  p_categoria text,
  p_titulo text,
  p_mensagem text,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_agrupamento_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
  v_existing_id uuid;
  v_new_id uuid;
  v_now timestamptz := now();
  v_is_critical_lead boolean := p_categoria IN ('novo_lead', 'lead_novo', 'lead_urgente', 'lead_ultimo_alerta', 'lead_timeout_redistribuido');
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;

  IF v_prefs IS NOT NULL AND p_categoria = ANY(v_prefs.categorias_silenciadas) THEN
    RETURN NULL;
  END IF;

  IF v_prefs IS NOT NULL
    AND v_prefs.horario_silencio_inicio IS NOT NULL
    AND v_prefs.horario_silencio_fim IS NOT NULL THEN
    IF (v_now AT TIME ZONE 'America/Sao_Paulo')::time
       BETWEEN v_prefs.horario_silencio_inicio AND v_prefs.horario_silencio_fim THEN
      RETURN NULL;
    END IF;
  END IF;

  IF NOT v_is_critical_lead
     AND p_agrupamento_key IS NOT NULL
     AND (v_prefs IS NULL OR v_prefs.agrupar_similares) THEN
    SELECT id INTO v_existing_id
    FROM notifications
    WHERE user_id = p_user_id
      AND agrupamento_key = p_agrupamento_key
      AND lida = false
      AND created_at > v_now - interval '30 minutes'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE notifications
      SET agrupamento_count = agrupamento_count + 1,
          mensagem = p_mensagem,
          dados = p_dados,
          created_at = v_now
      WHERE id = v_existing_id;
      RETURN v_existing_id;
    END IF;
  END IF;

  IF NOT v_is_critical_lead
     AND v_prefs IS NOT NULL
     AND v_prefs.intervalo_minimo_minutos > 0 THEN
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = p_user_id
        AND categoria = p_categoria
        AND created_at > v_now - (v_prefs.intervalo_minimo_minutos || ' minutes')::interval
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
  VALUES (p_user_id, p_tipo, p_categoria, p_titulo, p_mensagem, p_dados, p_agrupamento_key)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_lead_distribuido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.corretor_id IS NULL AND NEW.corretor_id IS NOT NULL AND NEW.distribuido_em IS NOT NULL THEN
    PERFORM criar_notificacao(
      NEW.corretor_id,
      'leads',
      'novo_lead',
      'Novo lead recebido!',
      'Lead ' || COALESCE(NEW.nome, 'Novo') || ' foi distribuído para você via roleta.',
      jsonb_build_object('lead_id', NEW.id, 'pipeline_lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento, 'url', '/aceite?lead=' || NEW.id::text),
      'novo_lead_' || NEW.id::text
    );
  END IF;

  IF OLD.corretor_id IS NOT NULL AND NEW.corretor_id IS NOT NULL
     AND OLD.corretor_id != NEW.corretor_id AND NEW.distribuido_em IS NOT NULL THEN
    PERFORM criar_notificacao(
      OLD.corretor_id,
      'leads',
      'lead_redistribuido',
      'Lead redistribuído',
      'Lead ' || COALESCE(NEW.nome, '') || ' foi redistribuído por falta de atendimento.',
      jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'url', '/pipeline'),
      NULL
    );

    PERFORM criar_notificacao(
      NEW.corretor_id,
      'leads',
      'novo_lead',
      'Novo lead recebido!',
      'Lead ' || COALESCE(NEW.nome, 'Novo') || ' redistribuído para você.',
      jsonb_build_object('lead_id', NEW.id, 'pipeline_lead_id', NEW.id, 'nome', NEW.nome, 'empreendimento', NEW.empreendimento, 'url', '/aceite?lead=' || NEW.id::text),
      'novo_lead_' || NEW.id::text
    );
  END IF;

  IF OLD.stage_id != NEW.stage_id THEN
    DECLARE
      v_stage_tipo text;
      v_corretor_nome text;
    BEGIN
      SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
      SELECT nome INTO v_corretor_nome FROM profiles WHERE user_id = NEW.corretor_id;

      IF v_stage_tipo = 'venda' THEN
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'vendas', 'venda_assinada',
          '🎉 Venda assinada!',
          COALESCE(v_corretor_nome, 'Corretor') || ' fechou venda: ' || COALESCE(NEW.empreendimento, 'Imóvel') || '. VGV: R$ ' || COALESCE(NEW.valor_estimado::text, '0'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome, 'empreendimento', NEW.empreendimento, 'vgv', NEW.valor_estimado),
          NULL
        FROM user_roles ur WHERE ur.role = 'admin';

        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'vendas', 'venda_assinada',
          '🎉 Venda assinada!',
          COALESCE(v_corretor_nome, 'Corretor') || ' fechou venda: ' || COALESCE(NEW.empreendimento, 'Imóvel'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome),
          NULL
        FROM user_roles ur WHERE ur.role = 'gestor';
      END IF;

      IF v_stage_tipo = 'proposta' THEN
        INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
        SELECT ur.user_id, 'propostas', 'proposta_criada',
          'Nova proposta criada',
          COALESCE(v_corretor_nome, 'Corretor') || ' criou proposta para ' || COALESCE(NEW.nome, 'cliente'),
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor_nome', v_corretor_nome),
          'proposta_criada'
        FROM user_roles ur WHERE ur.role = 'gestor';
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_push_enabled boolean;
  v_has_subscription boolean;
  v_url text;
BEGIN
  IF NEW.categoria IN ('novo_lead', 'lead_novo', 'lead_urgente', 'lead_ultimo_alerta', 'lead_timeout_redistribuido') THEN
    RETURN NEW;
  END IF;

  SELECT push_enabled INTO v_push_enabled
  FROM notification_preferences
  WHERE user_id = NEW.user_id;

  SELECT EXISTS(
    SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id
  ) INTO v_has_subscription;

  IF NOT v_has_subscription THEN
    RETURN NEW;
  END IF;

  IF v_push_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  v_url := COALESCE(NEW.dados->>'url', '/notificacoes');

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.titulo,
      'body', NEW.mensagem,
      'url', v_url,
      'data', jsonb_build_object('tipo', NEW.tipo, 'categoria', NEW.categoria, 'notification_id', NEW.id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.escalonar_notificacoes_leads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead record;
  v_count integer := 0;
  v_seconds_left integer;
BEGIN
  FOR v_lead IN
    SELECT pl.id, pl.nome, pl.corretor_id, pl.distribuido_em, pl.aceite_expira_em, pl.escalation_level,
           pl.telefone, pl.empreendimento
    FROM pipeline_leads pl
    WHERE pl.aceite_status IN ('pendente', 'aguardando_aceite', 'pendente_aceite')
      AND pl.corretor_id IS NOT NULL
      AND pl.distribuido_em IS NOT NULL
      AND pl.aceite_expira_em IS NOT NULL
  LOOP
    v_seconds_left := GREATEST(0, EXTRACT(EPOCH FROM (v_lead.aceite_expira_em - now()))::integer);

    IF v_seconds_left <= 120 AND v_seconds_left > 60 AND v_lead.escalation_level < 1 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_urgente',
        '⚡ Faltam 2 min para perder o lead!',
        'Aceite o lead ' || COALESCE(v_lead.nome, 'N/A') || ' agora para evitar o repasse automático.',
        jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'urgencia', 'alta', 'url', '/aceite?lead=' || v_lead.id::text),
        'lead_urgente_' || v_lead.id::text
      );
      UPDATE pipeline_leads SET escalation_level = 1, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;

    ELSIF v_seconds_left <= 60 AND v_lead.escalation_level < 2 THEN
      PERFORM criar_notificacao(
        v_lead.corretor_id, 'leads', 'lead_ultimo_alerta',
        '🚨 Último aviso antes do repasse!',
        COALESCE(v_lead.nome, 'Este lead') || ' será redistribuído em menos de 1 minuto se não for aceito.',
        jsonb_build_object('lead_id', v_lead.id, 'pipeline_lead_id', v_lead.id, 'urgencia', 'critica', 'url', '/aceite?lead=' || v_lead.id::text),
        'lead_ultimo_alerta_' || v_lead.id::text
      );
      UPDATE pipeline_leads SET escalation_level = 2, last_escalation_at = now() WHERE id = v_lead.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

INSERT INTO public.notification_preferences (
  user_id,
  popup_enabled,
  push_enabled,
  whatsapp_enabled,
  dashboard_alerts_enabled,
  agrupar_similares,
  intervalo_minimo_minutos
)
SELECT DISTINCT
  ps.user_id,
  true,
  true,
  false,
  true,
  true,
  0
FROM public.push_subscriptions ps
LEFT JOIN public.notification_preferences np ON np.user_id = ps.user_id
WHERE np.user_id IS NULL;