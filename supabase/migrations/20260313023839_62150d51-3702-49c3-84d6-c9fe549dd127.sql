
-- 1. Add telefone_normalizado column to pipeline_leads
ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS telefone_normalizado text;

-- 2. Function to normalize phone numbers (strip non-digits)
CREATE OR REPLACE FUNCTION public.normalize_telefone(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE 
    WHEN raw IS NULL THEN NULL
    ELSE regexp_replace(raw, '\D', '', 'g')
  END;
$$;

-- 3. Trigger to auto-normalize on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_pipeline_leads_normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.telefone_normalizado := public.normalize_telefone(NEW.telefone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_phone ON public.pipeline_leads;
CREATE TRIGGER trg_normalize_phone
  BEFORE INSERT OR UPDATE OF telefone ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_leads_normalize_phone();

-- 4. Backfill existing data
UPDATE public.pipeline_leads 
SET telefone_normalizado = public.normalize_telefone(telefone)
WHERE telefone IS NOT NULL AND telefone_normalizado IS NULL;

-- 5. Index for dedup and search
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_telefone_norm 
  ON public.pipeline_leads (telefone_normalizado) WHERE telefone_normalizado IS NOT NULL;

-- 6. Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_stage_corretor 
  ON public.pipeline_leads (stage_id, corretor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_updated 
  ON public.pipeline_leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_ultima_acao 
  ON public.pipeline_leads (ultima_acao_at DESC NULLS LAST);

-- 7. Playbook table for auto-tasks on stage transitions
CREATE TABLE IF NOT EXISTS public.pipeline_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  stage_gatilho_tipo text NOT NULL, -- e.g. 'visita_marcada', 'qualificacao'
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_playbook_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id uuid REFERENCES public.pipeline_playbooks(id) ON DELETE CASCADE NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'follow_up',
  prioridade text NOT NULL DEFAULT 'media',
  dias_offset integer NOT NULL DEFAULT 0, -- days after stage change
  hora_sugerida text, -- e.g. '09:00'
  ordem integer NOT NULL DEFAULT 0
);

ALTER TABLE public.pipeline_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_playbook_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read playbooks" ON public.pipeline_playbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read playbook tasks" ON public.pipeline_playbook_tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage playbooks" ON public.pipeline_playbooks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage playbook tasks" ON public.pipeline_playbook_tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Trigger: auto-create tasks from playbooks when stage changes
CREATE OR REPLACE FUNCTION public.trg_pipeline_playbook_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pb RECORD;
  task RECORD;
  new_stage_tipo text;
BEGIN
  IF OLD.stage_id = NEW.stage_id THEN
    RETURN NEW;
  END IF;
  
  -- Get the tipo of the new stage
  SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF new_stage_tipo IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find active playbooks matching this stage type
  FOR pb IN 
    SELECT id FROM public.pipeline_playbooks 
    WHERE stage_gatilho_tipo = new_stage_tipo AND ativo = true
  LOOP
    -- Create tasks for each playbook task
    FOR task IN
      SELECT * FROM public.pipeline_playbook_tarefas WHERE playbook_id = pb.id ORDER BY ordem
    LOOP
      INSERT INTO public.pipeline_tarefas (
        pipeline_lead_id, titulo, tipo, prioridade, status,
        vence_em, hora_vencimento, created_by, responsavel_id
      ) VALUES (
        NEW.id,
        task.titulo,
        task.tipo,
        task.prioridade,
        'pendente',
        (CURRENT_DATE + task.dias_offset)::text,
        task.hora_sugerida,
        COALESCE(NEW.corretor_id, NEW.created_by),
        NEW.corretor_id
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_playbook_on_stage ON public.pipeline_leads;
CREATE TRIGGER trg_playbook_on_stage
  AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_playbook_on_stage_change();

-- 9. Function to recalculate oportunidade_score
CREATE OR REPLACE FUNCTION public.recalc_oportunidade_score(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score integer := 0;
  v_lead RECORD;
  v_stage_tipo text;
  v_tarefas_concluidas integer;
  v_atividades integer;
  v_days_stale integer;
BEGIN
  SELECT * INTO v_lead FROM public.pipeline_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  
  -- Stage progression bonus
  SELECT tipo INTO v_stage_tipo FROM public.pipeline_stages WHERE id = v_lead.stage_id;
  v_score := v_score + CASE v_stage_tipo
    WHEN 'visita_realizada' THEN 30
    WHEN 'proposta' THEN 25
    WHEN 'negociacao' THEN 25
    WHEN 'visita_marcada' THEN 20
    WHEN 'qualificacao' THEN 15
    WHEN 'contato_inicial' THEN 10
    WHEN 'novo_lead' THEN 5
    ELSE 0
  END;
  
  -- Tasks completed
  SELECT COUNT(*) INTO v_tarefas_concluidas 
  FROM public.pipeline_tarefas 
  WHERE pipeline_lead_id = p_lead_id AND status = 'concluida';
  v_score := v_score + LEAST(v_tarefas_concluidas * 3, 15);
  
  -- Activities logged
  SELECT COUNT(*) INTO v_atividades 
  FROM public.pipeline_atividades 
  WHERE pipeline_lead_id = p_lead_id;
  v_score := v_score + LEAST(v_atividades * 2, 10);
  
  -- Valor estimado bonus
  IF v_lead.valor_estimado IS NOT NULL AND v_lead.valor_estimado > 0 THEN
    v_score := v_score + 10;
  END IF;
  
  -- Temperatura bonus
  v_score := v_score + CASE v_lead.temperatura
    WHEN 'muito_quente' THEN 15
    WHEN 'quente' THEN 10
    WHEN 'morno' THEN 5
    ELSE 0
  END;
  
  -- Staleness penalty
  v_days_stale := EXTRACT(DAY FROM (now() - COALESCE(v_lead.ultima_acao_at, v_lead.updated_at)))::integer;
  IF v_days_stale > 7 THEN
    v_score := v_score - LEAST((v_days_stale - 7) * 2, 20);
  END IF;
  
  -- Clamp 0-100
  v_score := GREATEST(0, LEAST(100, v_score));
  
  -- Update the lead
  UPDATE public.pipeline_leads SET oportunidade_score = v_score WHERE id = p_lead_id;
  
  RETURN v_score;
END;
$$;
