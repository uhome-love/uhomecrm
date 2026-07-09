CREATE OR REPLACE FUNCTION public.sync_lead_stage_on_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_stage_id uuid;
  v_lead RECORD;
  v_changed_at timestamptz;
BEGIN
  -- Só age quando o negócio vira 'vendido' (INSERT já vendido ou UPDATE mudando p/ vendido)
  IF NEW.fase IS DISTINCT FROM 'vendido' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.fase = 'vendido' THEN
    RETURN NEW;
  END IF;
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_venda_stage_id FROM public.pipeline_stages WHERE tipo = 'venda' LIMIT 1;
  IF v_venda_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, stage_id, corretor_id, arquivado
    INTO v_lead
    FROM public.pipeline_leads
    WHERE id = NEW.pipeline_lead_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Já está em Ganho: nada a fazer
  IF v_lead.stage_id = v_venda_stage_id THEN
    RETURN NEW;
  END IF;

  -- Não mexe em leads arquivados (histórico); o PDN cobre esses via fallback de vendas
  IF v_lead.arquivado THEN
    RETURN NEW;
  END IF;

  v_changed_at := COALESCE(NEW.data_assinatura::timestamptz, now());

  INSERT INTO public.pipeline_historico (pipeline_lead_id, stage_anterior_id, stage_novo_id, movido_por, observacao)
  VALUES (v_lead.id, v_lead.stage_id, v_venda_stage_id, COALESCE(v_lead.corretor_id, NEW.corretor_id), 'Sincronização automática: negócio marcado como vendido');

  UPDATE public.pipeline_leads
    SET stage_id = v_venda_stage_id,
        stage_changed_at = v_changed_at
    WHERE id = v_lead.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_stage_on_venda ON public.negocios;
CREATE TRIGGER trg_sync_lead_stage_on_venda
AFTER INSERT OR UPDATE OF fase ON public.negocios
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_stage_on_venda();