CREATE OR REPLACE FUNCTION public.get_lia_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lia_cron_secret' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_lia_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lia_cron_secret() TO service_role;