CREATE OR REPLACE FUNCTION trg_pipeline_playbook_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  pb RECORD;
  task RECORD;
  new_stage_tipo text;
BEGIN
  IF OLD.stage_id = NEW.stage_id THEN
    RETURN NEW;
  END IF;
  
  SELECT tipo INTO new_stage_tipo FROM public.pipeline_stages WHERE id = NEW.stage_id;
  IF new_stage_tipo IS NULL THEN
    RETURN NEW;
  END IF;
  
  FOR pb IN 
    SELECT id FROM public.pipeline_playbooks 
    WHERE stage_gatilho_tipo = new_stage_tipo AND ativo = true
  LOOP
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
        (CURRENT_DATE + task.dias_offset),
        task.hora_sugerida,
        COALESCE(NEW.corretor_id, NEW.created_by),
        NEW.corretor_id
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;