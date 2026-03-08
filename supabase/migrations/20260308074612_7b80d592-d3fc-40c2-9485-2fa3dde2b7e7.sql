
CREATE TABLE public.relatorios_1_1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id UUID NOT NULL,
  gerente_id UUID NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  conteudo_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dados_periodo JSONB DEFAULT '{}'::jsonb,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relatorios_1_1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores can manage own relatorios_1_1"
ON public.relatorios_1_1
FOR ALL
TO authenticated
USING (gerente_id = auth.uid())
WITH CHECK (gerente_id = auth.uid());

CREATE POLICY "Admins can view all relatorios_1_1"
ON public.relatorios_1_1
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
