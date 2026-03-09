-- Auto-create negócio when lead moves to visita_realizada stage
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stage_tipo text;
  v_old_stage_tipo text;
  v_gerente_id uuid;
  v_existing uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  SELECT tipo INTO v_old_stage_tipo FROM pipeline_stages WHERE id = OLD.stage_id;

  IF v_stage_tipo != 'visita_realizada' OR v_old_stage_tipo = 'visita_realizada' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.id LIMIT 1;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id INTO v_gerente_id
  FROM team_members tm
  WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo'
  LIMIT 1;

  INSERT INTO negocios (
    pipeline_lead_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.id, NEW.corretor_id, v_gerente_id,
    COALESCE(NEW.nome, 'Cliente'), NEW.telefone, NEW.empreendimento,
    'proposta', NEW.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_criar_negocio ON public.pipeline_leads;
CREATE TRIGGER trg_auto_criar_negocio
  AFTER UPDATE ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_criar_negocio_visita_realizada();

-- Also create negócio when visita is marked as realizada in agenda
CREATE OR REPLACE FUNCTION public.auto_criar_negocio_visita_agenda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead record;
  v_gerente_id uuid;
  v_existing uuid;
BEGIN
  IF NEW.status != 'realizada' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'realizada' THEN
    RETURN NEW;
  END IF;
  IF NEW.pipeline_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing FROM negocios WHERE pipeline_lead_id = NEW.pipeline_lead_id LIMIT 1;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_lead FROM pipeline_leads WHERE id = NEW.pipeline_lead_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT tm.gerente_id INTO v_gerente_id
  FROM team_members tm
  WHERE tm.user_id = NEW.corretor_id AND tm.status = 'ativo'
  LIMIT 1;

  INSERT INTO negocios (
    pipeline_lead_id, visita_id, corretor_id, gerente_id, nome_cliente, telefone,
    empreendimento, fase, vgv_estimado, origem, status, observacoes
  ) VALUES (
    NEW.pipeline_lead_id, NEW.id, NEW.corretor_id, v_gerente_id,
    COALESCE(v_lead.nome, NEW.cliente_nome, 'Cliente'),
    COALESCE(v_lead.telefone, NEW.cliente_telefone),
    COALESCE(v_lead.empreendimento, NEW.empreendimento),
    'proposta', v_lead.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_criar_negocio_visita ON public.visitas;
CREATE TRIGGER trg_auto_criar_negocio_visita
  AFTER INSERT OR UPDATE ON public.visitas
  FOR EACH ROW
  EXECUTE FUNCTION auto_criar_negocio_visita_agenda();