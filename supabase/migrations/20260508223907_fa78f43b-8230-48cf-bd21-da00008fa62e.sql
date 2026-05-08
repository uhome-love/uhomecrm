CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','vault','extensions','net'
AS $function$
DECLARE
  v_push_enabled boolean;
  v_has_subscription boolean;
  v_url text;
  v_supabase_url text;
  v_service_key text;
BEGIN
  SELECT push_enabled INTO v_push_enabled
  FROM notification_preferences WHERE user_id = NEW.user_id;

  SELECT EXISTS(SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id) INTO v_has_subscription;

  IF NOT v_has_subscription OR v_push_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Push trigger: vault secrets missing';
    RETURN NEW;
  END IF;

  v_url := COALESCE(NEW.dados->>'url', '/notificacoes');
  IF v_url = '/notificacoes' AND NEW.categoria IN ('novo_lead','lead_novo','lead_urgente','lead_ultimo_alerta') AND NEW.dados ? 'pipeline_lead_id' THEN
    v_url := '/aceite?lead=' || (NEW.dados->>'pipeline_lead_id');
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
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