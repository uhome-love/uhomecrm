
-- Allow gestores to insert their own metas
CREATE POLICY "Gestores can insert own metas"
ON public.ceo_metas_mensais FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = gerente_id);

-- Allow gestores to update their own metas
CREATE POLICY "Gestores can update own metas"
ON public.ceo_metas_mensais FOR UPDATE
TO authenticated
USING (auth.uid() = gerente_id);
