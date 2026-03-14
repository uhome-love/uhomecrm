
-- 1. Fix notifications: also prune UNREAD notifications older than 180 days
CREATE OR REPLACE FUNCTION public.prune_old_notifications(batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.notifications
  WHERE id IN (
    SELECT id FROM public.notifications
    WHERE 
      (lida = true AND created_at < NOW() - INTERVAL '90 days')
      OR
      (lida = false AND created_at < NOW() - INTERVAL '180 days')
    ORDER BY created_at ASC
    LIMIT batch_size
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 2. audit_log cleanup: keep 180 days
CREATE OR REPLACE FUNCTION public.cleanup_audit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.audit_log
  WHERE created_at < NOW() - INTERVAL '180 days';
$$;

-- 3. homi_conversations cleanup: prune conversations older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_homi_conversations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.homi_conversations
  WHERE updated_at < NOW() - INTERVAL '90 days';
$$;

-- 4. homi_briefing_diario cleanup: keep 60 days
CREATE OR REPLACE FUNCTION public.cleanup_homi_briefings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.homi_briefing_diario
  WHERE data::date < (CURRENT_DATE - INTERVAL '60 days');
$$;

-- 5. jetimob_processed cleanup: dedup table, keep 90 days
CREATE OR REPLACE FUNCTION public.cleanup_jetimob_processed()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.jetimob_processed
  WHERE created_at < NOW() - INTERVAL '90 days';
$$;

-- 6. coaching_sessions cleanup: keep 180 days
CREATE OR REPLACE FUNCTION public.cleanup_coaching_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.coaching_sessions
  WHERE created_at < NOW() - INTERVAL '180 days';
$$;
