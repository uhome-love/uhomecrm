
-- Replace single MELNICK_DAY auto-tag with multi-campaign auto-tagging
CREATE OR REPLACE FUNCTION public.auto_tag_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp text := lower(coalesce(NEW.empreendimento, ''));
  _orig text := lower(coalesce(NEW.origem, ''));
  _camp text := lower(coalesce(NEW.campanha, ''));
  _form text := lower(coalesce(NEW.formulario, ''));
  _obs text := lower(coalesce(NEW.observacoes, ''));
  _all_text text := _emp || ' ' || _orig || ' ' || _camp || ' ' || _form || ' ' || _obs;
  _tags text[] := coalesce(NEW.tags, '{}');
  
  -- Campaign tag mappings: keyword => tag
  _campaigns text[][] := ARRAY[
    ARRAY['open bosque', 'OPEN_BOSQUE'],
    ARRAY['las casas', 'LAS_CASAS'],
    ARRAY['orygem', 'ORYGEM'],
    ARRAY['casa tua', 'CASA_TUA'],
    ARRAY['lake eyre', 'LAKE_EYRE'],
    ARRAY['high garden iguatemi', 'HIGH_GARDEN_IGUATEMI'],
    ARRAY['seen', 'SEEN_TRES_FIGUEIRAS'],
    ARRAY['melnick', 'MELNICK_DAY'],
    ARRAY['alto lindoia', 'ALTO_LINDOIA'],
    ARRAY['alto lindóia', 'ALTO_LINDOIA'],
    ARRAY['shift', 'SHIFT'],
    ARRAY['casa bastian', 'CASA_BASTIAN'],
    ARRAY['duetto', 'DUETTO'],
    ARRAY['terrace', 'TERRACE']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(_campaigns, 1) LOOP
    IF _all_text LIKE '%' || _campaigns[i][1] || '%' THEN
      IF NOT (_campaigns[i][2] = ANY(_tags)) THEN
        _tags := array_append(_tags, _campaigns[i][2]);
      END IF;
    END IF;
  END LOOP;
  
  NEW.tags := _tags;
  RETURN NEW;
END;
$$;

-- Replace old trigger with new one
DROP TRIGGER IF EXISTS trg_auto_tag_melnick_day ON public.pipeline_leads;
DROP TRIGGER IF EXISTS trg_auto_tag_campaign ON public.pipeline_leads;
CREATE TRIGGER trg_auto_tag_campaign
  BEFORE INSERT OR UPDATE ON public.pipeline_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_tag_campaign();
