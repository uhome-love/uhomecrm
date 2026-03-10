
-- Allow corretores to insert their own credenciamentos
CREATE POLICY "Corretores insert own credenciamentos"
ON public.roleta_credenciamentos
FOR INSERT
TO authenticated
WITH CHECK (
  corretor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Allow corretores to update their own credenciamentos
CREATE POLICY "Corretores update own credenciamentos"
ON public.roleta_credenciamentos
FOR UPDATE
TO authenticated
USING (
  corretor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  corretor_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
