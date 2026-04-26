DO $$
DECLARE
  v_result jsonb;
BEGIN
  UPDATE pipeline_leads 
  SET segmento_id = '21180d72-f202-4d29-96cb-6ab88d37d5e1' 
  WHERE id = '44cd3ab7-be92-4883-9866-f6e82e77f314';
  
  SELECT public.distribuir_lead_roleta(
    '44cd3ab7-be92-4883-9866-f6e82e77f314'::uuid,
    '21180d72-f202-4d29-96cb-6ab88d37d5e1'::uuid
  ) INTO v_result;
  
  RAISE NOTICE 'Resultado: %', v_result;
END $$;