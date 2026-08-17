CREATE OR REPLACE FUNCTION public.consolidar_lead_ganho(p_negocio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_negocio record;
  v_lead_id uuid;
  v_user_id uuid;
  v_stage_venda uuid;
  v_changed integer := 0;
BEGIN
  SELECT * INTO v_negocio
  FROM public.negocios
  WHERE id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'negocio_not_found');
  END IF;

  IF v_negocio.fase IS DISTINCT FROM 'ganho' OR COALESCE(v_negocio.status, 'ativo') <> 'ativo' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'negocio_not_won');
  END IF;

  v_lead_id := COALESCE(v_negocio.pipeline_lead_id, v_negocio.lead_id);
  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lead_not_linked');
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  WHERE p.id = v_negocio.corretor_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'broker_user_not_found');
  END IF;

  SELECT ps.id INTO v_stage_venda
  FROM public.pipeline_stages ps
  WHERE ps.tipo = 'venda' AND COALESCE(ps.ativo, true)
  ORDER BY ps.ordem
  LIMIT 1;

  IF v_stage_venda IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'won_stage_not_found');
  END IF;

  UPDATE public.pipeline_leads pl
  SET stage_id = v_stage_venda,
      stage_changed_at = CASE WHEN pl.stage_id IS DISTINCT FROM v_stage_venda THEN now() ELSE pl.stage_changed_at END,
      negocio_id = v_negocio.id,
      corretor_id = v_user_id,
      aceite_status = 'aceito',
      aceito_em = COALESCE(pl.aceito_em, now()),
      distribuido_em = COALESCE(pl.distribuido_em, now()),
      aceite_expira_em = NULL,
      motivo_rejeicao = NULL,
      motivo_pendencia = NULL,
      arquivado = false,
      updated_at = now()
  WHERE pl.id = v_lead_id
    AND (
      pl.stage_id IS DISTINCT FROM v_stage_venda
      OR pl.negocio_id IS DISTINCT FROM v_negocio.id
      OR pl.corretor_id IS DISTINCT FROM v_user_id
      OR pl.aceite_status IS DISTINCT FROM 'aceito'
      OR pl.aceite_expira_em IS NOT NULL
      OR pl.motivo_rejeicao IS NOT NULL
      OR pl.motivo_pendencia IS NOT NULL
      OR pl.arquivado IS DISTINCT FROM false
    );

  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed > 0 AND NOT EXISTS (
    SELECT 1 FROM public.negocios_atividades na
    WHERE na.negocio_id = v_negocio.id AND na.tipo = 'lead_ganho_consolidado'
  ) THEN
    INSERT INTO public.negocios_atividades (negocio_id, tipo, titulo, descricao, created_by)
    VALUES (
      v_negocio.id,
      'lead_ganho_consolidado',
      'Lead consolidado como Ganho',
      'Aceite, corretor, etapa e vínculo do lead foram consolidados automaticamente.',
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'changed', v_changed > 0, 'lead_id', v_lead_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.consolidar_lead_ganho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidar_lead_ganho(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_consolidar_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fase = 'ganho' AND COALESCE(NEW.status, 'ativo') = 'ativo' THEN
    PERFORM public.consolidar_lead_ganho(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_consolidar_lead_ganho ON public.negocios;
CREATE TRIGGER trg_consolidar_lead_ganho
AFTER INSERT OR UPDATE OF fase, status, corretor_id, pipeline_lead_id, lead_id
ON public.negocios
FOR EACH ROW
EXECUTE FUNCTION public.trg_consolidar_lead_ganho();

CREATE OR REPLACE FUNCTION public.trg_proteger_lead_ganho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_corretor_esperado uuid;
BEGIN
  SELECT p.user_id INTO v_corretor_esperado
  FROM public.negocios n
  JOIN public.profiles p ON p.id = n.corretor_id
  WHERE n.fase = 'ganho'
    AND COALESCE(n.status, 'ativo') = 'ativo'
    AND (n.id = OLD.negocio_id OR n.pipeline_lead_id = OLD.id OR n.lead_id = OLD.id)
  ORDER BY n.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_corretor_esperado IS NOT NULL
     AND (
       NEW.corretor_id IS DISTINCT FROM v_corretor_esperado
       OR NEW.aceite_status IS DISTINCT FROM 'aceito'
       OR NEW.aceite_expira_em IS NOT NULL
       OR NEW.arquivado IS DISTINCT FROM false
     ) THEN
    RAISE EXCEPTION 'Lead com venda ganha não pode voltar à distribuição'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proteger_lead_ganho ON public.pipeline_leads;
CREATE TRIGGER trg_proteger_lead_ganho
BEFORE UPDATE OF corretor_id, aceite_status, aceite_expira_em, arquivado
ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_proteger_lead_ganho();