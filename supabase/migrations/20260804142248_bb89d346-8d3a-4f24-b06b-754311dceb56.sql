CREATE OR REPLACE FUNCTION public.assert_acts_as(p_corretor_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- Chamada interna (service_role/edge/cron): auth.uid() é NULL.
  -- Seguro porque EXECUTE de anon já foi revogado nas 9 RPCs de ação (só authenticated + service_role chegam aqui).
  IF auth.uid() IS NULL OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN;
  END IF;
  IF p_corretor_id = auth.uid()
     OR p_corretor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'forbidden';
END $fn$;