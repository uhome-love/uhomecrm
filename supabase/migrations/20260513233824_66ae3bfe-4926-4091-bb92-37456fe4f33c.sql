
-- 1) Cleanup: arquiva todos leads "Reengajamento (Nutrição)" que estão descartados sem corretor
-- (vieram de respostas que NÃO foram "Sim" — auto-replies, "Não", "boa noite", etc.)
UPDATE public.pipeline_leads
   SET arquivado = true,
       updated_at = now()
 WHERE origem = 'Reengajamento (Nutrição)'
   AND aceite_status = 'descartado'
   AND corretor_id IS NULL
   AND arquivado = false;

-- 2) Trigger preventivo: se um insert chegar com origem=Reengajamento (Nutrição)
-- e aceite_status='descartado' (vindo do Make.com sem ser "Sim"),
-- automaticamente marca arquivado=true para não poluir dashboard nem roleta.
CREATE OR REPLACE FUNCTION public.trg_auto_archive_reengaj_descartado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origem = 'Reengajamento (Nutrição)'
     AND NEW.aceite_status = 'descartado' THEN
    NEW.arquivado := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_archive_reengaj_descartado ON public.pipeline_leads;
CREATE TRIGGER auto_archive_reengaj_descartado
BEFORE INSERT ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_archive_reengaj_descartado();
