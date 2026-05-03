
-- Fix: permitir excluir negócios que já têm lead/pos-vendas/progressão associados
-- Adiciona ON DELETE SET NULL nas FKs que ainda bloqueavam a exclusão

ALTER TABLE public.pipeline_leads
  DROP CONSTRAINT IF EXISTS pipeline_leads_negocio_id_fkey,
  ADD CONSTRAINT pipeline_leads_negocio_id_fkey
    FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE SET NULL;

ALTER TABLE public.pos_vendas
  DROP CONSTRAINT IF EXISTS pos_vendas_negocio_id_fkey,
  ADD CONSTRAINT pos_vendas_negocio_id_fkey
    FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE SET NULL;

ALTER TABLE public.lead_progressao
  DROP CONSTRAINT IF EXISTS lead_progressao_negocio_id_fkey,
  ADD CONSTRAINT lead_progressao_negocio_id_fkey
    FOREIGN KEY (negocio_id) REFERENCES public.negocios(id) ON DELETE SET NULL;
