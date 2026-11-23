REVOKE EXECUTE ON FUNCTION public.homi_consulta(text, text) FROM PUBLIC, anon, authenticated;
ALTER POLICY "empreendimento_fichas_select" ON public.empreendimento_fichas USING (auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated can read overrides" ON public.empreendimento_overrides USING (auth.uid() IS NOT NULL);
ALTER POLICY "Authenticated users can read pagadoria_config" ON public.pagadoria_config USING (auth.uid() IS NOT NULL);
ALTER POLICY "All authenticated can view motivations" ON public.corretor_motivations USING (auth.uid() IS NOT NULL);