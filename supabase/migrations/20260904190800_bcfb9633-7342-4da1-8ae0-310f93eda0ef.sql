DO $mig$
DECLARE
  d text;
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['reativar_base_lead_para_fila_ceo','reativar_lead_para_fila_ceo'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = f
     LIMIT 1;
    IF d IS NULL THEN
      RAISE EXCEPTION 'Função % não encontrada', f;
    END IF;
    IF position($q$v_tpl ILIKE '%casatuacanoas%' OR v_tpl ILIKE '%casa tua canoas%' OR v_tpl ILIKE '%casa_tua_canoas%'$q$ in d) = 0 THEN
      RAISE EXCEPTION 'Padrão Canoas não encontrado em %', f;
    END IF;
    d := replace(
      d,
      $q$v_tpl ILIKE '%casatuacanoas%' OR v_tpl ILIKE '%casa tua canoas%' OR v_tpl ILIKE '%casa_tua_canoas%'$q$,
      $q$v_tpl ILIKE '%canoas%'$q$
    );
    EXECUTE d;
  END LOOP;

  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'reativar_oferta_ativa_para_fila_ceo'
   LIMIT 1;
  IF d IS NULL THEN
    RAISE EXCEPTION 'Função reativar_oferta_ativa_para_fila_ceo não encontrada';
  END IF;
  IF position($q$  IF v_is_casatua THEN
    v_empreend := 'Casa Tua';$q$ in d) = 0 THEN
    RAISE EXCEPTION 'Padrão Casa Tua não encontrado em reativar_oferta_ativa_para_fila_ceo';
  END IF;
  d := replace(
    d,
    $q$  IF v_is_casatua THEN
    v_empreend := 'Casa Tua';$q$,
    $q$  IF v_tpl ILIKE '%canoas%' THEN
    v_empreend := 'Casa Tua Canoas';
    v_seg_id := v_seg_moradia;
    v_foco_label := 'Casa Tua Canoas';
  ELSIF v_is_casatua THEN
    v_empreend := 'Casa Tua';$q$
  );
  EXECUTE d;
END
$mig$;