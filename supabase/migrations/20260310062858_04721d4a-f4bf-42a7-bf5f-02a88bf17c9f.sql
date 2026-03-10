
-- Fix trg_lead_to_negocio_on_visita_realizada to resolve profile_id
CREATE OR REPLACE FUNCTION public.trg_lead_to_negocio_on_visita_realizada()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_stage_tipo text;
  negocio_uuid uuid;
  v_profile_id uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.stage_id IS NULL OR OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN RETURN NEW; END IF;
  IF NEW.negocio_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id LIMIT 1;
  IF new_stage_tipo IS DISTINCT FROM 'visita_realizada' THEN RETURN NEW; END IF;

  SELECT id INTO negocio_uuid FROM public.negocios WHERE pipeline_lead_id = NEW.id ORDER BY created_at DESC LIMIT 1;
  IF negocio_uuid IS NOT NULL THEN
    NEW.negocio_id := negocio_uuid;
    RETURN NEW;
  END IF;

  -- Resolve profile_id from auth user_id
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
  RETURN NEW;
END;
$$;

-- Fix auto_criar_negocio_visita_realizada to resolve profile_id
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_realizada()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_stage_tipo text;
  v_old_stage_tipo text;
  v_gerente_id uuid;
  v_existing uuid;
  v_profile_id uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN RETURN NEW; END IF;

  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT tipo INTO v_old_stage_tipo FROM pipeline_stages WHERE id = OLD.stage_id;

  IF v_stage_tipo != 'visita_realizada' OR v_old_stage_tipo = 'visita_realizada' THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.id LIMIT 1;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT tm.gerente_id INTO v_gerente_id FROM team_members tm WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo' LIMIT 1;

  -- Resolve profile_id from auth user_id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.corretor_id;

  INSERT INTO negocios (
    pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.id, COALESCE(v_profile_id, NEW.corretor_id), v_gerente_id,
    COALESCE(NEW.nome, 'Cliente'), NEW.telefone, NEW.empreendimento,
    'proposta', NEW.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  );
  RETURN NEW;
END;
$$;

-- Fix auto_criar_negocio_visita_agenda to resolve profile_id
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_agenda()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_lead record;
  v_gerente_id uuid;
  v_existing uuid;
  v_profile_id uuid;
BEGIN
  IF NEW.status != 'realizada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'realizada' THEN RETURN NEW; END IF;
  IF NEW.pipeline_lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.pipeline_lead_id LIMIT 1;
  IF FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_lead FROM pipeline_leads WHERE id = NEW.pipeline_lead_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT tm.gerente_id INTO v_gerente_id FROM team_members tm WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo' LIMIT 1;

  -- Resolve profile_id from auth user_id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = NEW.corretor_id;

  INSERT INTO negocios (
    pipeline_lead_id, visita_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.pipeline_lead_id, NEW.id, COALESCE(v_profile_id, NEW.corretor_id), v_gerente_id,
    COALESCE(v_lead.nome, NEW.nome_cliente, 'Cliente'),
    COALESCE(v_lead.telefone, NEW.telefone),
    COALESCE(v_lead.empreendimento, NEW.empreendimento),
    'proposta', v_lead.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  );
  RETURN NEW;
END;
$$;

-- Fix existing broken data: update negocios where corretor_id is an auth user_id instead of profile_id
UPDATE negocios n
SET corretor_id = p.id
FROM profiles p
WHERE n.corretor_id = p.user_id
  AND n.corretor_id != p.id;
