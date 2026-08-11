ALTER TABLE public.rh_candidatos ADD COLUMN IF NOT EXISTS gerente_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_rh_candidatos_gerente_id ON public.rh_candidatos (gerente_id);

CREATE POLICY "Gestor select seus candidatos"
ON public.rh_candidatos
FOR SELECT
TO authenticated
USING (gerente_id IS NOT NULL AND gerente_id = auth.uid() AND public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor update seus candidatos"
ON public.rh_candidatos
FOR UPDATE
TO authenticated
USING (gerente_id IS NOT NULL AND gerente_id = auth.uid() AND public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (gerente_id = auth.uid() AND public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestor select entrevistas dos seus candidatos"
ON public.rh_entrevistas
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.rh_candidatos c
    WHERE c.id = rh_entrevistas.candidato_id
      AND c.gerente_id = auth.uid()
  )
);