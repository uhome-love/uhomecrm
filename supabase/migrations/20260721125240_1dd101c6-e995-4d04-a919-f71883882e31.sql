-- Diretoria pode publicar/gerir anotações no pipeline (feature "Publicar no lead" do PDN)
CREATE POLICY "Diretores can insert pipeline anotacoes"
  ON public.pipeline_anotacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) AND autor_id = auth.uid());

CREATE POLICY "Diretores can update pipeline anotacoes"
  ON public.pipeline_anotacoes
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can delete pipeline anotacoes"
  ON public.pipeline_anotacoes
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role));