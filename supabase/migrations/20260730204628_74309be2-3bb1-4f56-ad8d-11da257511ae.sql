DROP POLICY IF EXISTS "Gerentes can view own pdn" ON public.pdn_entries;
DROP POLICY IF EXISTS "Gerentes can update own pdn" ON public.pdn_entries;

CREATE POLICY "Gestores can view pdn notes"
ON public.pdn_entries FOR SELECT TO authenticated
USING (
  auth.uid() = gerente_id
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
);

CREATE POLICY "Gestores can update pdn notes"
ON public.pdn_entries FOR UPDATE TO authenticated
USING (
  auth.uid() = gerente_id
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
)
WITH CHECK (
  auth.uid() = gerente_id
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
);