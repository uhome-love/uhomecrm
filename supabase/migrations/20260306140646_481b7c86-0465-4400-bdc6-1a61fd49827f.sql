-- Allow corretores to delete their own visitas
CREATE POLICY "Corretores can delete own visitas"
  ON public.visitas
  FOR DELETE
  USING (corretor_id = auth.uid());
