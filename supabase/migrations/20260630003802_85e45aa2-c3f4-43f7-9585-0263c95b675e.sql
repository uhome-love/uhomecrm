-- 1) Permite que o papel "diretor" tenha visão de toda a empresa nas RPCs da Central de Relatórios
DO $$
DECLARE
  r record;
  def text;
  fn_names text[] := ARRAY[
    'get_relatorio_pipeline_leads','get_relatorio_oferta_ativa','get_relatorio_visitas',
    'get_relatorio_negocios','get_relatorio_vendas','get_relatorio_metas',
    'get_relatorio_sla','get_relatorio_cohort','get_ranking_central'
  ];
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(fn_names)
  LOOP
    def := pg_get_functiondef(r.oid);
    -- idempotente: só aplica se ainda não tiver o papel diretor no gate
    IF position('has_role(auth.uid(),''diretor''::app_role)' in def) = 0 THEN
      def := replace(
        def,
        'has_role(auth.uid(),''admin''::app_role)',
        '(has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''diretor''::app_role))'
      );
      EXECUTE def;
    END IF;
  END LOOP;
END $$;

-- 2) Mapeia a Diretora Comercial (Gabrielle) ao gerente Junior Padilha (faltava),
--    para que o Dashboard de gerente dela some também a equipe do Junior.
INSERT INTO public.diretoria_equipes (diretor_auth_id, gerente_auth_id)
SELECT '7882d73e-ff5c-4b23-9b08-2adeadcd1800', '7a270cc1-a457-4a02-8a62-462ba5a98937'
WHERE NOT EXISTS (
  SELECT 1 FROM public.diretoria_equipes
  WHERE diretor_auth_id = '7882d73e-ff5c-4b23-9b08-2adeadcd1800'
    AND gerente_auth_id = '7a270cc1-a457-4a02-8a62-462ba5a98937'
);