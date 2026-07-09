GRANT UPDATE ON public.reengajamento_dispatch_runs TO authenticated;

CREATE POLICY "admin gestor update runs"
ON public.reengajamento_dispatch_runs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));