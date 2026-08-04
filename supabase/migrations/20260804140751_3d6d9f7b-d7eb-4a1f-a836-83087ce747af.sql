-- Salvar token do Meta Ads no Vault (somente admin)
CREATE OR REPLACE FUNCTION public.set_meta_ads_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF coalesce(p_token, '') = '' THEN
    RAISE EXCEPTION 'token vazio';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'meta_ads_access_token';

  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_token, 'meta_ads_access_token', 'Meta Ads long-lived access token');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;

  UPDATE public.integration_settings
     SET value = 'vault:meta_ads_access_token', updated_at = now()
   WHERE key = 'meta_ads_access_token';

  IF NOT FOUND THEN
    INSERT INTO public.integration_settings (key, value, label)
    VALUES ('meta_ads_access_token', 'vault:meta_ads_access_token', 'meta_ads_access_token');
  END IF;

  RETURN jsonb_build_object('ok', true, 'in_vault', true, 'last4', right(p_token, 4));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_meta_ads_token(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_meta_ads_token(text) TO authenticated, service_role;

-- Ler token (apenas service_role / processos internos), com fallback legado
CREATE OR REPLACE FUNCTION public.get_meta_ads_token_internal()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored text;
  v_secret text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND coalesce(current_setting('role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT value INTO v_stored FROM public.integration_settings WHERE key = 'meta_ads_access_token';

  IF v_stored = 'vault:meta_ads_access_token' THEN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'meta_ads_access_token';
    RETURN v_secret;
  END IF;

  -- fallback legado: valor ainda em texto na tabela
  RETURN v_stored;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_meta_ads_token_internal() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_meta_ads_token_internal() TO service_role;