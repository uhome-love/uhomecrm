
-- Add dedup check for notifications: prevent identical notifications within 30 min
CREATE OR REPLACE FUNCTION public.check_notification_dedup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing
  FROM notifications
  WHERE user_id = NEW.user_id
    AND titulo = NEW.titulo
    AND created_at > (now() - interval '30 minutes')
  LIMIT 1;

  IF FOUND THEN
    RETURN NULL; -- prevent insert
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_dedup ON public.notifications;
CREATE TRIGGER trg_notification_dedup
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION check_notification_dedup();
