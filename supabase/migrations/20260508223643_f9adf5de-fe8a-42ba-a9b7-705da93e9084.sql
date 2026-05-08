CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_push_enabled boolean;
  v_has_subscription boolean;
  v_url text;
BEGIN
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
  IF v_url = '/notificacoes' AND NEW.categoria IN ('novo_lead','lead_novo','lead_urgente','lead_ultimo_alerta') AND NEW.dados ? 'pipeline_lead_id' THEN
    v_url := '/aceite?lead=' || (NEW.dados->>'pipeline_lead_id');
  END IF;

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
      'data', jsonb_build_object('tipo', NEW.tipo, 'categoria', NEW.categoria, 'notification_id', NEW.id, 'tag', COALESCE(NEW.agrupamento_key, NEW.id::text))
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;