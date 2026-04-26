DO $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT public.distribuir_lead_roleta('44cd3ab7-be92-4883-9866-f6e82e77f314'::uuid) INTO v_result;
  RAISE NOTICE 'Resultado distribuição: %', v_result;
END $$;