CREATE OR REPLACE FUNCTION public.trg_proteger_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_esperado uuid;
  v_stage_venda uuid;
BEGIN
  SELECT p.user_id INTO v_corretor_esperado
  FROM public.negocios n
  JOIN public.profiles p ON p.id = n.corretor_id
  WHERE n.fase = 'ganho'
    AND COALESCE(n.status, 'ativo') = 'ativo'
    AND (n.id = OLD.negocio_id OR n.pipeline_lead_id = OLD.id OR n.lead_id = OLD.id)
  ORDER BY n.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_corretor_esperado IS NOT NULL THEN
    SELECT ps.id INTO v_stage_venda
    FROM public.pipeline_stages ps
    WHERE ps.tipo = 'venda' AND COALESCE(ps.ativo, true)
    ORDER BY ps.ordem
    LIMIT 1;

    IF NEW.stage_id IS DISTINCT FROM v_stage_venda
       OR NEW.corretor_id IS DISTINCT FROM v_corretor_esperado
       OR NEW.aceite_status IS DISTINCT FROM 'aceito'
       OR NEW.aceite_expira_em IS NOT NULL
       OR NEW.arquivado IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Lead com venda ganha não pode voltar à distribuição'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;