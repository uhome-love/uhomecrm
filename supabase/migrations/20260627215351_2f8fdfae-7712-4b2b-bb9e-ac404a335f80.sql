CREATE POLICY "Managers can delete partnerships"
ON public.pipeline_parcerias
FOR DELETE
USING (
  (criado_por = auth.uid())
  OR (corretor_principal_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);