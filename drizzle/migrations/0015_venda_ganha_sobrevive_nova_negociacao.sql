CREATE OR REPLACE FUNCTION public.trg_clear_negocio_on_stage_regress()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE new_ordem INT; new_tipo TEXT; old_ordem INT;
BEGIN
  SELECT ordem, tipo INTO new_ordem, new_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
  SELECT ordem INTO old_ordem FROM public.pipeline_stages WHERE id = OLD.stage_id;
  IF new_ordem IS NULL OR new_ordem >= 6 THEN RETURN NEW; END IF;
  IF new_tipo IN ('descarte','venda','caiu') THEN RETURN NEW; END IF;
  IF old_ordem IS NULL OR old_ordem < 6 THEN RETURN NEW; END IF;

  NEW.flag_status := COALESCE(NEW.flag_status,'{}'::jsonb) - 'status_negociacao' - 'status_contrato';

  IF NEW.negocio_id IS NOT NULL THEN
    -- Venda ganha (fase='ganho') NUNCA é arquivada por mudança de etapa: cliente que volta
    -- a negociar abre uma nova negociação; a venda só sai por distrato/desistência.
    UPDATE public.negocios SET status='arquivado', updated_at=now()
     WHERE id = NEW.negocio_id AND status='ativo' AND fase <> 'ganho';
    NEW.negocio_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_proteger_lead_ganho()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_corretor_esperado uuid; v_novo_tipo text;
BEGIN
  SELECT p.user_id INTO v_corretor_esperado
  FROM public.negocios n JOIN public.profiles p ON p.id = n.corretor_id
  WHERE n.fase = 'ganho' AND COALESCE(n.status, 'ativo') = 'ativo'
    AND (n.id = OLD.negocio_id OR n.pipeline_lead_id = OLD.id OR n.lead_id = OLD.id)
  ORDER BY n.updated_at DESC NULLS LAST LIMIT 1;

  IF v_corretor_esperado IS NOT NULL THEN
    SELECT tipo INTO v_novo_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
    -- Cliente que já comprou pode voltar a negociar (nova negociação), mas não pode
    -- ser descartado, arquivado, trocar de corretor nem voltar à distribuição.
    IF COALESCE(v_novo_tipo,'') IN ('descarte','caiu')
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