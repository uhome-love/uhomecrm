
CREATE OR REPLACE FUNCTION public._capi_set_cron_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name='capi_cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'capi_cron_secret', 'Header x-cron-secret for meta-capi-dispatch');
  ELSE
    PERFORM vault.update_secret(v_id, _secret);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._capi_set_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._capi_set_cron_secret(text) TO service_role;
