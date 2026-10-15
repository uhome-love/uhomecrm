CREATE OR REPLACE FUNCTION public.roleta_tem_visita_hoje(p_auth_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_atividades pa
    WHERE pa.responsavel_id = p_auth_user_id
      AND pa.tipo IN ('visita_agendada','visita_realizada')
      AND (pa.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ) OR EXISTS (
    SELECT 1 FROM public.visitas v
    WHERE (v.corretor_id = p_auth_user_id OR v.corretor_id IN (SELECT id FROM public.profiles WHERE user_id = p_auth_user_id))
      AND (
        -- marcou hoje (para qualquer data)
        ((v.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND v.status NOT IN ('cancelada','reagendada'))
        OR
        -- visita com data de hoje marcada/confirmada/realizada
        (v.data_visita::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
          AND v.status IN ('marcada','confirmada','realizada'))
      )
  );
$function$;