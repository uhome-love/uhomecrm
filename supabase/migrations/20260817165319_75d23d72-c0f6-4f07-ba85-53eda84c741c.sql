DROP TRIGGER IF EXISTS trg_proteger_lead_ganho ON public.pipeline_leads;
CREATE TRIGGER trg_proteger_lead_ganho
BEFORE UPDATE OF stage_id, corretor_id, aceite_status, aceite_expira_em, arquivado
ON public.pipeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_proteger_lead_ganho();