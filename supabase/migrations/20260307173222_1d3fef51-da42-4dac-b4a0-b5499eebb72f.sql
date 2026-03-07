
-- Add flexible responsibility fields to pipeline_leads
ALTER TABLE public.pipeline_leads 
  ADD COLUMN IF NOT EXISTS gerente_id uuid,
  ADD COLUMN IF NOT EXISTS modo_conducao text NOT NULL DEFAULT 'corretor_conduz';

-- Add complexity score for auto-suggestion
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS complexidade_score integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pipeline_leads.modo_conducao IS 'corretor_conduz | corretor_gerente | gerente_conduz';
COMMENT ON COLUMN public.pipeline_leads.complexidade_score IS 'Auto-calculated complexity score for manager suggestion';

-- Create trigger to auto-calculate complexity and suggest manager
CREATE OR REPLACE FUNCTION public.calcular_complexidade_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score integer := 0;
  v_stage_tipo text;
  v_gerente_ids uuid[];
  v_gid uuid;
  v_corretor_nome text;
BEGIN
  -- Valor alto (+30)
  IF COALESCE(NEW.valor_estimado, 0) >= 500000 THEN v_score := v_score + 30;
  ELSIF COALESCE(NEW.valor_estimado, 0) >= 300000 THEN v_score := v_score + 15;
  END IF;

  -- Prioridade alta (+20)
  IF NEW.prioridade_lead = 'alta' THEN v_score := v_score + 20;
  ELSIF NEW.prioridade_lead = 'media' THEN v_score := v_score + 10;
  END IF;

  -- Stage avançado (+20)
  SELECT tipo INTO v_stage_tipo FROM pipeline_stages WHERE id = NEW.stage_id;
  IF v_stage_tipo IN ('proposta', 'negociacao', 'assinatura') THEN v_score := v_score + 20;
  ELSIF v_stage_tipo IN ('visita_realizada', 'visita_marcada') THEN v_score := v_score + 10;
  END IF;

  NEW.complexidade_score := v_score;

  -- Auto-alert managers when complexity >= 50 AND no gerente assigned AND stage changed to visita_realizada
  IF v_stage_tipo = 'visita_realizada' 
     AND (OLD.stage_id IS NULL OR OLD.stage_id != NEW.stage_id)
     AND NEW.gerente_id IS NULL THEN
    
    SELECT nome INTO v_corretor_nome FROM team_members WHERE user_id = NEW.corretor_id LIMIT 1;
    
    SELECT array_agg(DISTINCT ur.user_id) INTO v_gerente_ids
    FROM user_roles ur WHERE ur.role IN ('gestor', 'admin');

    IF v_gerente_ids IS NOT NULL THEN
      FOREACH v_gid IN ARRAY v_gerente_ids LOOP
        INSERT INTO notifications (user_id, categoria, tipo, titulo, mensagem, dados)
        VALUES (
          v_gid, 'pipeline', 'visita_realizada',
          '🏠 Visita realizada — Sugestão de acompanhamento',
          COALESCE(v_corretor_nome, 'Corretor') || ' realizou visita com ' || COALESCE(NEW.nome, 'cliente') || 
          CASE WHEN NEW.valor_estimado >= 500000 THEN ' (valor alto: R$ ' || to_char(NEW.valor_estimado, 'FM999G999G999') || ')' ELSE '' END ||
          '. Considere entrar no negócio.',
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'corretor', v_corretor_nome, 'empreendimento', NEW.empreendimento, 'valor', NEW.valor_estimado, 'complexidade', NEW.complexidade_score)
        );
      END LOOP;
    END IF;
  END IF;

  -- Also alert when proposta is sent (high value)
  IF v_stage_tipo = 'proposta'
     AND (OLD.stage_id IS NULL OR OLD.stage_id != NEW.stage_id)
     AND NEW.gerente_id IS NULL
     AND COALESCE(NEW.valor_estimado, 0) >= 300000 THEN
    
    SELECT nome INTO v_corretor_nome FROM team_members WHERE user_id = NEW.corretor_id LIMIT 1;
    
    SELECT array_agg(DISTINCT ur.user_id) INTO v_gerente_ids
    FROM user_roles ur WHERE ur.role IN ('gestor', 'admin');

    IF v_gerente_ids IS NOT NULL THEN
      FOREACH v_gid IN ARRAY v_gerente_ids LOOP
        INSERT INTO notifications (user_id, categoria, tipo, titulo, mensagem, dados)
        VALUES (
          v_gid, 'pipeline', 'proposta_alta',
          '⚠️ Oportunidade relevante — Proposta enviada',
          'Proposta de R$ ' || to_char(COALESCE(NEW.valor_estimado, 0), 'FM999G999G999') || ' para ' || COALESCE(NEW.nome, 'cliente') || ' (' || COALESCE(NEW.empreendimento, 'N/A') || ').',
          jsonb_build_object('lead_id', NEW.id, 'nome', NEW.nome, 'valor', NEW.valor_estimado)
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trg_notify_visita_realizada ON public.pipeline_leads;
DROP TRIGGER IF EXISTS trg_calcular_complexidade ON public.pipeline_leads;

CREATE TRIGGER trg_calcular_complexidade
  BEFORE INSERT OR UPDATE ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION calcular_complexidade_lead();
