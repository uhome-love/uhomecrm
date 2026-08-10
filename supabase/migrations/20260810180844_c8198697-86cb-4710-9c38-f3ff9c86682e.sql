-- 1) Tabela interna de backfill sem RLS
ALTER TABLE public._pilot_backfill_2026_07_26 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._pilot_backfill_2026_07_26 FROM anon;
GRANT SELECT ON public._pilot_backfill_2026_07_26 TO authenticated;
GRANT ALL ON public._pilot_backfill_2026_07_26 TO service_role;

DROP POLICY IF EXISTS "Admins manage pilot backfill" ON public._pilot_backfill_2026_07_26;
CREATE POLICY "Admins manage pilot backfill"
ON public._pilot_backfill_2026_07_26
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) jetimob_corretores: PII (email/telefone/creci) só para admin/gestor
DROP POLICY IF EXISTS "Authenticated users can view jetimob corretores" ON public.jetimob_corretores;
CREATE POLICY "Admins and gestores can view jetimob corretores"
ON public.jetimob_corretores
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
);