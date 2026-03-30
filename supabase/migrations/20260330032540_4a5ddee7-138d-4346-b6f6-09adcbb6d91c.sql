
CREATE POLICY "Users can delete own atividades"
ON public.pipeline_atividades
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "Users can delete own historico"
ON public.pipeline_historico
FOR DELETE
TO authenticated
USING (movido_por = auth.uid());
