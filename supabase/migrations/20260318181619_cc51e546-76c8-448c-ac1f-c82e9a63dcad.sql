
CREATE TABLE public.lead_imoveis_indicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  imovel_codigo text NOT NULL,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_lead_imoveis_indicados_lead ON public.lead_imoveis_indicados(lead_id);
CREATE INDEX idx_lead_imoveis_indicados_criado_por ON public.lead_imoveis_indicados(criado_por);

ALTER TABLE public.lead_imoveis_indicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretores veem próprias indicações"
  ON public.lead_imoveis_indicados FOR SELECT TO authenticated
  USING (criado_por = auth.uid());

CREATE POLICY "Corretores inserem indicações"
  ON public.lead_imoveis_indicados FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Corretores deletam próprias indicações"
  ON public.lead_imoveis_indicados FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

CREATE POLICY "Gestores veem todas indicações"
  ON public.lead_imoveis_indicados FOR SELECT TO authenticated
  USING (public.is_gerente_or_above());
