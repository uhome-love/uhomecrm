-- Permitir exclusão de negócios por CEO (admin) e gerentes (gestor)
CREATE POLICY "Admins and gestores can delete negocios"
ON public.negocios
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);