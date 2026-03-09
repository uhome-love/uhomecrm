
CREATE OR REPLACE FUNCTION auto_criar_negocio_visita_agenda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    COALESCE(v_lead.nome, NEW.nome_cliente, 'Cliente'),
    COALESCE(v_lead.telefone, NEW.telefone),
    COALESCE(v_lead.empreendimento, NEW.empreendimento),
    'proposta', v_lead.valor_estimado, 'visita_realizada', 'ativo',
    'Criado automaticamente após visita realizada'
  );

  RETURN NEW;
END;
$$;
