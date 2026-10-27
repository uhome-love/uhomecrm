CREATE OR REPLACE FUNCTION public.trg_pipeline_lead_distribuido_reentrada()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- Lead que volta (novo interesse/reativação) mantinha distribuido_em do ciclo
  -- antigo e nascia "estagnado". Aceite novo muito depois da distribuição = novo ciclo.
  IF NEW.aceito_em IS NOT NULL
     AND NEW.aceito_em IS DISTINCT FROM OLD.aceito_em
     AND (NEW.distribuido_em IS NULL OR NEW.aceito_em > NEW.distribuido_em + interval '1 day') THEN
    NEW.distribuido_em := NEW.aceito_em;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pipeline_lead_distribuido_reentrada ON public.pipeline_leads;
CREATE TRIGGER trg_pipeline_lead_distribuido_reentrada
BEFORE UPDATE OF aceito_em ON public.pipeline_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_pipeline_lead_distribuido_reentrada();

UPDATE public.pipeline_leads
SET distribuido_em = aceito_em
WHERE arquivado = false
  AND aceito_em IS NOT NULL
  AND aceito_em > now() - interval '30 days'
  AND (distribuido_em IS NULL OR aceito_em > distribuido_em + interval '1 day');