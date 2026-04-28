-- 1) Corrige a função create_nurturing_sequence para o schema ATUAL de nurturing_cadencias
CREATE OR REPLACE FUNCTION public.create_nurturing_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_tipo TEXT;
  v_step RECORD;
  v_send_at TIMESTAMPTZ;
BEGIN
  -- Só dispara em mudança real de stage
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_stage_tipo
  FROM pipeline_stages
  WHERE id = NEW.stage_id;

  -- Só cria sequência para descarte com tipo reengajavel
  IF v_stage_tipo = 'descarte' AND NEW.tipo_descarte = 'reengajavel' THEN
    v_send_at := NOW();
    FOR v_step IN
      SELECT id, step_number, delay_dias, canal, template_name
      FROM nurturing_cadencias
      WHERE is_active = true
        AND stage_tipo = 'descarte'
      ORDER BY step_number ASC
    LOOP
      v_send_at := v_send_at + (COALESCE(v_step.delay_dias, 0) * INTERVAL '1 day');

      BEGIN
        INSERT INTO lead_nurturing_sequences (
          lead_id, cadencia_id, step_index, canal,
          template_key, scheduled_for, status
        ) VALUES (
          NEW.id, v_step.id, COALESCE(v_step.step_number, 0),
          v_step.canal, v_step.template_name,
          v_send_at, 'pendente'
        );
      EXCEPTION WHEN OTHERS THEN
        -- Não bloqueia a mudança de stage se a inserção da nurturing falhar
        RAISE WARNING 'create_nurturing_sequence insert failed: %', SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Move para Descarte os leads reengajáveis que ficaram presos
WITH descarte_stage AS (
  SELECT id FROM public.pipeline_stages WHERE tipo = 'descarte' LIMIT 1
)
UPDATE public.pipeline_leads pl
SET stage_id = ds.id,
    stage_changed_at = now(),
    ultima_acao_at = now(),
    updated_at = now()
FROM descarte_stage ds
WHERE pl.tipo_descarte = 'reengajavel'
  AND pl.motivo_descarte ILIKE 'Inativado:%'
  AND pl.stage_id <> ds.id
  AND pl.arquivado = false;