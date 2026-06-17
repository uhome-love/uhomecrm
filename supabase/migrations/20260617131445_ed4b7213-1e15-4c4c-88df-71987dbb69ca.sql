CREATE POLICY "Diretores can view managed teams visitas"
ON public.visitas FOR SELECT
USING (
  corretor_id IN (
    SELECT user_id FROM public.resolve_managed_brokers(auth.uid())
  )
);