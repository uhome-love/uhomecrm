
-- Update all 3 trigger functions to also move the lead to "Convertido" stage after creating negócio

-- 1. trg_lead_to_negocio_on_visita_realizada
CREATE OR REPLACE FUNCTION public.trg_lead_to_negocio_on_visita_realizada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_stage_tipo text;
  negocio_uuid uuid;
  v_profile_id uuid;
  v_convertido_stage uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.stage_id IS NULL OR OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN RETURN NEW; END IF;
  IF NEW.negocio_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id LIMIT 1;
  IF new_stage_tipo IS DISTINCT FROM 'visita_realizada' THEN RETURN NEW; END IF;

  SELECT id INTO negocio_uuid FROM public.negocios WHERE pipeline_lead_id = NEW.id ORDER BY created_at DESC LIMIT 1;
  IF negocio_uuid IS NOT NULL THEN
    NEW.negocio_id := negocio_uuid;
    -- Move to Convertido
    SELECT id INTO v_convertido_stage FROM public.pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
    IF v_convertido_stage IS NOT NULL THEN
      NEW.stage_id := v_convertido_stage;
    END IF;
    RETURN NEW;
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.corretor_id;

  INSERT INTO public.negocios (
    pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, vgv_estimado, fase, status, created_at, updated_at, fase_changed_at
  ) VALUES (
    NEW.id, COALESCE(v_profile_id, NEW.corretor_id), NEW.gerente_id,
    NEW.nome, NEW.telefone, NEW.empreendimento, NEW.valor_estimado,
    'novo_negocio', 'ativo', now(), now(), now()
  ) RETURNING id INTO negocio_uuid;

  NEW.negocio_id := negocio_uuid;

  -- Move to Convertido stage
  SELECT id INTO v_convertido_stage FROM public.pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
  IF v_convertido_stage IS NOT NULL THEN
    NEW.stage_id := v_convertido_stage;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. auto_criar_negocio_visita_realizada
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_realizada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage_tipo text;
  v_old_stage_tipo text;
  v_gerente_id uuid;
  v_existing uuid;
  v_profile_id uuid;
  v_convertido_stage uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN RETURN NEW; END IF;

  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT tipo INTO v_old_stage_tipo FROM pipeline_stages WHERE id = OLD.stage_id;

  IF v_stage_tipo != 'visita_realizada' OR v_old_stage_tipo = 'visita_realizada' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.id LIMIT 1;
  IF FOUND THEN
    NEW.negocio_id := v_existing;
    SELECT id INTO v_convertido_stage FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
    IF v_convertido_stage IS NOT NULL THEN NEW.stage_id := v_convertido_stage; END IF;
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id INTO v_gerente_id FROM team_members tm WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo' LIMIT 1;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.corretor_id;

  INSERT INTO negocios (
    pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.id, COALESCE(v_profile_id, NEW.corretor_id), v_gerente_id,
    COALESCE(NEW.nome, 'Cliente'), NEW.telefone, NEW.empreendimento,
    'novo_negocio', NEW.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  ) RETURNING id INTO v_existing;

  NEW.negocio_id := v_existing;
  SELECT id INTO v_convertido_stage FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
  IF v_convertido_stage IS NOT NULL THEN NEW.stage_id := v_convertido_stage; END IF;

  RETURN NEW;
END;
$$;

-- 3. auto_criar_negocio_visita_agenda
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_agenda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead record;
  v_gerente_id uuid;
  v_existing uuid;
  v_profile_id uuid;
  v_convertido_stage uuid;
BEGIN
  IF NEW.status != 'realizada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'realizada' THEN RETURN NEW; END IF;
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.pipeline_lead_id LIMIT 1;
  IF FOUND THEN
    -- Still move lead to convertido even if negocio already exists
    SELECT id INTO v_convertido_stage FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
    IF v_convertido_stage IS NOT NULL THEN
      UPDATE pipeline_leads SET stage_id = v_convertido_stage, negocio_id = v_existing WHERE id = NEW.pipeline_lead_id AND negocio_id IS NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_lead FROM pipeline_leads WHERE id = NEW.pipeline_lead_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT tm.gerente_id INTO v_gerente_id FROM team_members tm WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo' LIMIT 1;
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.corretor_id;

  INSERT INTO negocios (
    pipeline_lead_id, visita_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.pipeline_lead_id, NEW.id, COALESCE(v_profile_id, NEW.corretor_id), v_gerente_id,
    COALESCE(v_lead.nome, NEW.nome_cliente, 'Cliente'),
    COALESCE(v_lead.telefone, NEW.telefone),
    COALESCE(v_lead.empreendimento, NEW.empreendimento),
    'novo_negocio', v_lead.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  ) RETURNING id INTO v_existing;

  -- Move lead to Convertido
  SELECT id INTO v_convertido_stage FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1;
  IF v_convertido_stage IS NOT NULL THEN
    UPDATE pipeline_leads SET stage_id = v_convertido_stage, negocio_id = v_existing WHERE id = NEW.pipeline_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix existing leads that already have negocio_id: move them to Convertido stage
UPDATE pipeline_leads
SET stage_id = (SELECT id FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1)
WHERE negocio_id IS NOT NULL
  AND stage_id != (SELECT id FROM pipeline_stages WHERE tipo = 'convertido' AND pipeline_tipo = 'leads' AND ativo = true LIMIT 1);
