
CREATE OR REPLACE FUNCTION public.get_corretor_pdn(p_mes text DEFAULT NULL::text)
 RETURNS SETOF pdn_entries
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_corretor_nome text;
  v_target_mes text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Get corretor name from profile
  SELECT p.nome INTO v_corretor_nome
  FROM profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  -- Default to current month
  v_target_mes := COALESCE(p_mes, to_char(now(), 'YYYY-MM'));

  RETURN QUERY
  SELECT pe.*
  FROM pdn_entries pe
  WHERE pe.mes = v_target_mes
    AND (
      -- Match by corretor name field (case-insensitive, partial match)
      (v_corretor_nome IS NOT NULL AND (
        LOWER(pe.corretor) = LOWER(v_corretor_nome)
        OR LOWER(pe.corretor) = LOWER(split_part(v_corretor_nome, ' ', 1))
        OR LOWER(v_corretor_nome) LIKE '%' || LOWER(pe.corretor) || '%'
        OR LOWER(pe.corretor) LIKE '%' || LOWER(split_part(v_corretor_nome, ' ', 1)) || '%'
      ))
      -- Or match by linked visit belonging to this corretor
      OR EXISTS (
        SELECT 1 FROM visitas v
        WHERE v.id = pe.linked_visit_id
          AND v.corretor_id = v_user_id
      )
    )
  ORDER BY pe.created_at DESC;
END;
$function$;
