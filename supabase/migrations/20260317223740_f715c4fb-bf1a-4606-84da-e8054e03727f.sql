
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
  _campaign_tag text := null;
  _campaign_tags text[] := ARRAY['OPEN_BOSQUE','LAS_CASAS','ORYGEM','CASA_TUA','LAKE_EYRE','HIGH_GARDEN_IGUATEMI','SEEN_TRES_FIGUEIRAS','MELNICK_DAY','ALTO_LINDOIA','SHIFT','CASA_BASTIAN','DUETTO','TERRACE'];
BEGIN
  -- Decide ONE primary campaign tag only, in priority order
  IF _all_text LIKE '%melnick%' THEN
    _campaign_tag := 'MELNICK_DAY';
  ELSIF _all_text LIKE '%high garden iguatemi%' THEN
    _campaign_tag := 'HIGH_GARDEN_IGUATEMI';
  ELSIF _all_text LIKE '%seen três figueiras%' OR _all_text LIKE '%seen tres figueiras%' OR _all_text LIKE '%seen%' THEN
    _campaign_tag := 'SEEN_TRES_FIGUEIRAS';
  ELSIF _all_text LIKE '%open bosque%' THEN
    _campaign_tag := 'OPEN_BOSQUE';
  ELSIF _all_text LIKE '%las casas%' THEN
    _campaign_tag := 'LAS_CASAS';
  ELSIF _all_text LIKE '%orygem%' THEN
    _campaign_tag := 'ORYGEM';
  ELSIF _all_text LIKE '%casa tua%' THEN
    _campaign_tag := 'CASA_TUA';
  ELSIF _all_text LIKE '%lake eyre%' THEN
    _campaign_tag := 'LAKE_EYRE';
  ELSIF _all_text LIKE '%alto lindoia%' OR _all_text LIKE '%alto lindóia%' THEN
    _campaign_tag := 'ALTO_LINDOIA';
  ELSIF _all_text LIKE '%shift%' THEN
    _campaign_tag := 'SHIFT';
  ELSIF _all_text LIKE '%casa bastian%' THEN
    _campaign_tag := 'CASA_BASTIAN';
  ELSIF _all_text LIKE '%duetto%' THEN
    _campaign_tag := 'DUETTO';
  ELSIF _all_text LIKE '%terrace%' THEN
    _campaign_tag := 'TERRACE';
  END IF;

  -- Remove previous campaign tags to keep only one active campaign tag
  SELECT coalesce(array_agg(tag), '{}')
  INTO _tags
  FROM unnest(_tags) AS tag
  WHERE NOT (tag = ANY(_campaign_tags));

  -- Re-add chosen campaign tag if detected
  IF _campaign_tag IS NOT NULL THEN
    _tags := array_append(_tags, _campaign_tag);
  END IF;

  NEW.tags := _tags;
  RETURN NEW;
END;
$$;
