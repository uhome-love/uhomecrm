
-- Function: When OA lead is approved (com_interesse), auto-create a pipeline_leads entry
CREATE OR REPLACE FUNCTION public.oa_aproveitado_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stage_id uuid;
  v_lead oferta_ativa_leads%ROWTYPE;
BEGIN
  -- Only trigger on status change to 'aproveitado'
  IF NEW.status <> 'aproveitado' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'aproveitado' THEN
    RETURN NEW;
  END IF;

  -- Get the "novo_lead" stage
  SELECT id INTO v_stage_id
  FROM pipeline_stages
  WHERE tipo = 'novo_lead' AND ativo = true
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this OA lead already has a pipeline entry (by phone dedup)
  IF NEW.telefone_normalizado IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pipeline_leads
      WHERE telefone = NEW.telefone OR telefone = NEW.telefone_normalizado
      LIMIT 1
    ) THEN
      RETURN NEW; -- Already in pipeline, skip
    END IF;
  END IF;

  -- Insert into pipeline_leads
  INSERT INTO pipeline_leads (
    nome, telefone, telefone2, email, empreendimento,
    stage_id, corretor_id, origem, origem_detalhe,
    observacoes, created_by
  ) VALUES (
    NEW.nome,
    NEW.telefone,
    NEW.telefone2,
    NEW.email,
    NEW.empreendimento,
    v_stage_id,
    NEW.corretor_id,
    'Oferta Ativa',
    COALESCE(NEW.campanha, NEW.origem, 'Reativação'),
    'Lead reativado via Oferta Ativa. Lista: ' || COALESCE(
      (SELECT nome FROM oferta_ativa_listas WHERE id = NEW.lista_id), 'N/A'
    ) || '. Tentativas: ' || NEW.tentativas_count::text,
    NEW.corretor_id
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to oferta_ativa_leads
DROP TRIGGER IF EXISTS trg_oa_aproveitado_to_pipeline ON oferta_ativa_leads;
CREATE TRIGGER trg_oa_aproveitado_to_pipeline
  AFTER UPDATE ON oferta_ativa_leads
  FOR EACH ROW
  EXECUTE FUNCTION oa_aproveitado_to_pipeline();
