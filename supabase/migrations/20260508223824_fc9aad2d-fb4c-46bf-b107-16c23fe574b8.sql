CREATE OR REPLACE FUNCTION public.vault_secret_upsert(p_name text, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','vault','extensions'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    SELECT vault.create_secret(p_secret, p_name) INTO v_id;
  ELSE
    PERFORM vault.update_secret(v_id, p_secret, p_name);
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_secret_upsert(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_secret_upsert(text,text) TO service_role;