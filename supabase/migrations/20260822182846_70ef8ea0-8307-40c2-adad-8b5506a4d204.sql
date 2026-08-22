GRANT DELETE ON public.lia_estado TO authenticated;
GRANT DELETE ON public.lia_conversas TO authenticated;
GRANT DELETE ON public.lia_followups TO authenticated;
GRANT UPDATE ON public.lia_followups TO authenticated;
GRANT ALL ON public.lia_estado TO service_role;
GRANT ALL ON public.lia_conversas TO service_role;
GRANT ALL ON public.lia_followups TO service_role;

DROP POLICY IF EXISTS "Admin pode excluir lia_estado" ON public.lia_estado;
CREATE POLICY "Admin pode excluir lia_estado"
ON public.lia_estado FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin pode excluir lia_conversas" ON public.lia_conversas;
CREATE POLICY "Admin pode excluir lia_conversas"
ON public.lia_conversas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin pode excluir lia_followups" ON public.lia_followups;
CREATE POLICY "Admin pode excluir lia_followups"
ON public.lia_followups FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));