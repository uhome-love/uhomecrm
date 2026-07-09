-- SELECT: incluir diretor (já havia admin)
DROP POLICY IF EXISTS "Gerentes can view own pdn" ON public.pdn_entries;
CREATE POLICY "Gerentes can view own pdn"
ON public.pdn_entries FOR SELECT
USING (
  auth.uid() = gerente_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

-- UPDATE: próprio gestor OU admin OU diretor
DROP POLICY IF EXISTS "Gerentes can update own pdn" ON public.pdn_entries;
CREATE POLICY "Gerentes can update own pdn"
ON public.pdn_entries FOR UPDATE
USING (
  auth.uid() = gerente_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

-- DELETE: próprio gestor OU admin OU diretor
DROP POLICY IF EXISTS "Gerentes can delete own pdn" ON public.pdn_entries;
CREATE POLICY "Gerentes can delete own pdn"
ON public.pdn_entries FOR DELETE
USING (
  auth.uid() = gerente_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);