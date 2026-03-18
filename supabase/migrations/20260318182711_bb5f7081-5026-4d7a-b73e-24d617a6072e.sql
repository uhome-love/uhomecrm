
-- Disable auto-task creation trigger (corretores reclamaram que tarefas surgem sem eles criarem)
DROP TRIGGER IF EXISTS trg_playbook_on_stage ON public.pipeline_leads;

-- Also deactivate playbooks to prevent any other code path from using them
UPDATE pipeline_playbooks SET ativo = false WHERE ativo = true;
