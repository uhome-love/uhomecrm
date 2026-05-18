-- Fix: pagadoria_solicitacoes SELECT policy was allowing ANY gestor to read
-- all commission requests (with CPF, RG, document URLs) across all teams.
-- Restrict gestor access to solicitacoes whose underlying negocio is handled
-- by a corretor in their team (via is_lead_in_my_team helper).

DROP POLICY IF EXISTS "Users can view own solicitacoes" ON public.pagadoria_solicitacoes;

CREATE POLICY "Users can view own solicitacoes"
ON public.pagadoria_solicitacoes
FOR SELECT
TO authenticated
USING (
  solicitante_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'backoffice'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.negocios n
      WHERE n.id = pagadoria_solicitacoes.negocio_id
        AND public.is_lead_in_my_team(n.corretor_id)
    )
  )
);