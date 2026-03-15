
-- Add tags column to pipeline_leads
ALTER TABLE public.pipeline_leads 
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_pipeline_leads_tags 
  ON public.pipeline_leads USING GIN (tags);

-- Auto-tag trigger: add MELNICK_DAY when origin/campaign contains "melnick"
CREATE OR REPLACE FUNCTION public.auto_tag_melnick_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if any relevant field contains "melnick"
  IF (
    lower(coalesce(NEW.origem, '')) LIKE '%melnick%' OR
    lower(coalesce(NEW.empreendimento, '')) LIKE '%melnick%' OR
    lower(coalesce(NEW.campanha, '')) LIKE '%melnick%' OR
    lower(coalesce(NEW.formulario, '')) LIKE '%melnick%' OR
    lower(coalesce(NEW.observacoes, '')) LIKE '%melnick day%' OR
    lower(coalesce(NEW.observacoes, '')) LIKE '%evento melnick%'
  ) THEN
    -- Add tag if not already present
    IF NOT ('MELNICK_DAY' = ANY(coalesce(NEW.tags, '{}'))) THEN
      NEW.tags := array_append(coalesce(NEW.tags, '{}'), 'MELNICK_DAY');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on insert and update
DROP TRIGGER IF EXISTS trg_auto_tag_melnick_day ON public.pipeline_leads;
CREATE TRIGGER trg_auto_tag_melnick_day
  BEFORE INSERT OR UPDATE ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_tag_melnick_day();
