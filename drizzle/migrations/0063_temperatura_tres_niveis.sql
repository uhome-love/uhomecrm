CREATE OR REPLACE FUNCTION public.normalizar_temperatura_lead()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.temperatura IS NULL OR btrim(NEW.temperatura) = '' THEN
    NEW.temperatura := 'nao_definida';
  ELSE
    NEW.temperatura := CASE lower(btrim(NEW.temperatura))
      WHEN 'muito_quente' THEN 'quente'
      WHEN 'urgente' THEN 'quente'
      WHEN 'quente' THEN 'quente'
      WHEN 'morno' THEN 'morno'
      WHEN 'gelado' THEN 'frio'
      WHEN 'frio' THEN 'frio'
      ELSE 'nao_definida'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a0_normalizar_temperatura ON public.pipeline_leads;
CREATE TRIGGER a0_normalizar_temperatura
BEFORE INSERT OR UPDATE OF temperatura ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.normalizar_temperatura_lead();

-- Conversão dos valores antigos sem disparar gatilhos (não mexe em relógios de atividade nem sincronizações)
SET LOCAL session_replication_role = replica;
UPDATE public.pipeline_leads SET temperatura = 'quente' WHERE temperatura IN ('muito_quente', 'urgente');
UPDATE public.pipeline_leads SET temperatura = 'frio' WHERE temperatura = 'gelado';
SET LOCAL session_replication_role = origin;

COMMENT ON COLUMN public.pipeline_leads.temperatura IS 'Escala única: frio | morno | quente | nao_definida (normalizada por trigger).';