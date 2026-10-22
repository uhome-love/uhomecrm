ALTER TABLE public.intermediacoes
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS desconto_nf_pct numeric,
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_lead_id uuid,
  ADD COLUMN IF NOT EXISTS valor_bruto numeric,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric,
  ADD COLUMN IF NOT EXISTS parcelas jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sistema';
CREATE UNIQUE INDEX IF NOT EXISTS uq_intermediacao_negocio_ativa ON public.intermediacoes(negocio_id) WHERE status = 'ativa' AND negocio_id IS NOT NULL;
CREATE POLICY diretor_select_intermediacoes ON public.intermediacoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'diretor'::app_role));
CREATE POLICY admin_diretor_update_intermediacoes ON public.intermediacoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS comprovante_ato_path text,
  ADD COLUMN IF NOT EXISTS intermediacao_id uuid REFERENCES public.intermediacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distrato_em date,
  ADD COLUMN IF NOT EXISTS distrato_motivo text,
  ADD COLUMN IF NOT EXISTS distrato_por uuid;

CREATE TABLE public.intermediacao_beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intermediacao_id uuid NOT NULL REFERENCES public.intermediacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  papel text NOT NULL,
  user_id uuid,
  percentual numeric,
  valor_bruto numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intermediacao_beneficiarios TO authenticated;
GRANT ALL ON public.intermediacao_beneficiarios TO service_role;
ALTER TABLE public.intermediacao_beneficiarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_benef_all ON public.intermediacao_beneficiarios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));
CREATE INDEX idx_benef_interm ON public.intermediacao_beneficiarios(intermediacao_id);

CREATE TABLE public.negocios_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid REFERENCES public.negocios(id) ON DELETE SET NULL,
  intermediacao_id uuid REFERENCES public.intermediacoes(id) ON DELETE CASCADE,
  parcela_num int NOT NULL DEFAULT 1,
  vencimento date,
  valor numeric NOT NULL DEFAULT 0,
  forma text,
  status text NOT NULL DEFAULT 'pendente',
  recebido_em date,
  comprovante_path text,
  observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negocios_recebimentos TO authenticated;
GRANT ALL ON public.negocios_recebimentos TO service_role;
ALTER TABLE public.negocios_recebimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_receb_all ON public.negocios_recebimentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));
CREATE INDEX idx_receb_venc ON public.negocios_recebimentos(status, vencimento);

CREATE TABLE public.custos_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  categoria text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custos_fixos TO authenticated;
GRANT ALL ON public.custos_fixos TO service_role;
ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_custos_all ON public.custos_fixos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));

CREATE TABLE public.custos_midia_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL,
  canal text NOT NULL DEFAULT 'outros',
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custos_midia_manual TO authenticated;
GRANT ALL ON public.custos_midia_manual TO service_role;
ALTER TABLE public.custos_midia_manual ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_midia_all ON public.custos_midia_manual FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretor'::app_role));