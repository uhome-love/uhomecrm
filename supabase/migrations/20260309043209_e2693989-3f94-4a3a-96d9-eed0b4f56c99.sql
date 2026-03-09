-- Cria negócio automaticamente quando lead entra em "visita_realizada" (e ainda não possui negocio_id)

CREATE OR REPLACE FUNCTION public.trg_lead_to_negocio_on_visita_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_stage_tipo text;
  negocio_uuid uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Só quando muda o stage
  IF NEW.stage_id IS NULL OR OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  -- Evita duplicação
  IF NEW.negocio_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT tipo
  INTO new_stage_tipo
  FROM public.pipeline_stages
  WHERE id = NEW.stage_id
  LIMIT 1;

  IF new_stage_tipo IS DISTINCT FROM 'visita_realizada' THEN
    RETURN NEW;
  END IF;

  -- Se já existir um negócio para este lead (por qualquer motivo), só vincula
  SELECT id
  INTO negocio_uuid
  FROM public.negocios
  WHERE pipeline_lead_id = NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF negocio_uuid IS NOT NULL THEN
    NEW.negocio_id := negocio_uuid;
    RETURN NEW;
  END IF;

  -- Cria o negócio
  INSERT INTO public.negocios (
    pipeline_lead_id,
    corretor_id,
    gerente_id,
    nome_cliente,
    telefone,
    empreendimento,
    vgv_estimado,
    fase,
    status,
    created_at,
    updated_at,
    fase_changed_at
  ) VALUES (
    NEW.id,
    NEW.corretor_id,
    NEW.gerente_id,
    NEW.nome,
    NEW.telefone,
    NEW.empreendimento,
    NEW.valor_estimado,
    'novo_negocio',
    'ativo',
    now(),
    now(),
    now()
  )
  RETURNING id INTO negocio_uuid;

  NEW.negocio_id := negocio_uuid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_to_negocio_on_visita_realizada ON public.pipeline_leads;

CREATE TRIGGER lead_to_negocio_on_visita_realizada
BEFORE UPDATE OF stage_id ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_lead_to_negocio_on_visita_realizada();
