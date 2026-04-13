
-- 1. Add flag_status column to pipeline_leads
ALTER TABLE public.pipeline_leads
ADD COLUMN IF NOT EXISTS flag_status jsonb DEFAULT '{}'::jsonb;

-- 2. Create new stages: Busca, Aquecimento, Visita
INSERT INTO public.pipeline_stages (id, nome, tipo, ordem, pipeline_tipo, ativo, cor)
VALUES
  (gen_random_uuid(), 'Busca', 'busca', 3, 'leads', true, '#8B5CF6'),
  (gen_random_uuid(), 'Aquecimento', 'aquecimento', 4, 'leads', true, '#F97316'),
  (gen_random_uuid(), 'Visita', 'visita', 5, 'leads', true, '#10B981');

-- 3. Rename "Em Evolução" to "Pós-Visita" and update tipo
UPDATE public.pipeline_stages
SET nome = 'Pós-Visita', tipo = 'pos_visita', ordem = 6
WHERE id = 'd932fb49-419c-4fda-bae1-9ef06ee2d033';

-- 4. Update order of Negócio Criado and Descarte
UPDATE public.pipeline_stages SET ordem = 7 WHERE id = 'a8a1a867-5b0c-414e-9532-8873c4ca5a0f';
UPDATE public.pipeline_stages SET ordem = 8 WHERE id = '1dd66c25-3848-4053-9f66-82e902989b4d';

-- 5. Migrate leads: Qualificação → Busca
UPDATE public.pipeline_leads
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE tipo = 'busca' AND pipeline_tipo = 'leads' LIMIT 1),
    stage_changed_at = stage_changed_at -- preserve original date
WHERE stage_id = '1ea43190-44c8-43ec-91b4-409b055b0e58';

-- 6. Migrate leads: Possível Visita → Aquecimento
UPDATE public.pipeline_leads
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE tipo = 'aquecimento' AND pipeline_tipo = 'leads' LIMIT 1),
    stage_changed_at = stage_changed_at
WHERE stage_id = '2096921e-f8c9-4212-91c8-dae055bc5710';

-- 7. Migrate leads: Visita Marcada → Visita (flag: marcada)
UPDATE public.pipeline_leads
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE tipo = 'visita' AND pipeline_tipo = 'leads' LIMIT 1),
    flag_status = jsonb_build_object('visita', 'marcada'),
    stage_changed_at = stage_changed_at
WHERE stage_id = 'c9fcf0ad-dcab-4575-b91f-3f76610e4d44';

-- 8. Migrate leads: Visita Realizada → Visita (flag: realizada)
UPDATE public.pipeline_leads
SET stage_id = (SELECT id FROM public.pipeline_stages WHERE tipo = 'visita' AND pipeline_tipo = 'leads' LIMIT 1),
    flag_status = jsonb_build_object('visita', 'realizada'),
    stage_changed_at = stage_changed_at
WHERE stage_id = '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14';

-- 9. Deactivate old stages
UPDATE public.pipeline_stages SET ativo = false WHERE id IN (
  '1ea43190-44c8-43ec-91b4-409b055b0e58',  -- Qualificação
  '2096921e-f8c9-4212-91c8-dae055bc5710',  -- Possível Visita
  'c9fcf0ad-dcab-4575-b91f-3f76610e4d44',  -- Visita Marcada
  '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14'   -- Visita Realizada
);

-- 10. Update nurturing trigger to handle new stage types
CREATE OR REPLACE FUNCTION public.create_nurturing_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_tipo TEXT;
  v_cadencia RECORD;
  v_step RECORD;
  v_send_at TIMESTAMPTZ;
BEGIN
  -- Only fire when stage changes
  IF OLD.stage_id = NEW.stage_id THEN
    RETURN NEW;
  END IF;

  -- Get the new stage tipo
  SELECT tipo INTO v_stage_tipo
  FROM pipeline_stages
  WHERE id = NEW.stage_id;

  -- Only create sequences for descarte with reengajavel tipo
  IF v_stage_tipo = 'descarte' AND NEW.tipo_descarte = 'reengajavel' THEN
    -- Find active cadencia for reengajamento
    FOR v_cadencia IN
      SELECT id, passos
      FROM nurturing_cadencias
      WHERE ativo = true
        AND tipo = 'reengajamento'
    LOOP
      -- Create sequence entries for each step
      v_send_at := NOW();
      FOR v_step IN
        SELECT * FROM jsonb_array_elements(v_cadencia.passos) WITH ORDINALITY AS t(step, idx)
        ORDER BY t.idx
      LOOP
        v_send_at := v_send_at + ((v_step.step->>'delay_dias')::int * INTERVAL '1 day');

        INSERT INTO lead_nurturing_sequences (
          lead_id, cadencia_id, step_index, canal,
          template_key, scheduled_for, status
        ) VALUES (
          NEW.id, v_cadencia.id, (v_step.idx - 1)::int,
          v_step.step->>'canal',
          v_step.step->>'template_key',
          v_send_at, 'pendente'
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_descarte_reengajamento ON public.pipeline_leads;
CREATE TRIGGER trg_descarte_reengajamento
  AFTER UPDATE OF stage_id ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.create_nurturing_sequence();
