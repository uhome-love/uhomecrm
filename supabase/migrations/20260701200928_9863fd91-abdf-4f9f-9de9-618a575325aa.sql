CREATE POLICY "Diretores can view all pipeline leads"
  ON public.pipeline_leads FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can view all pipeline tarefas"
  ON public.pipeline_tarefas FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can view all pipeline atividades"
  ON public.pipeline_atividades FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can view all pipeline historico"
  ON public.pipeline_historico FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can view all pipeline anotacoes"
  ON public.pipeline_anotacoes FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Diretores can view all negocios"
  ON public.negocios FOR SELECT
  USING (has_role(auth.uid(), 'diretor'::app_role));