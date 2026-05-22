-- Tabela de supressão da Campanha Átrio
CREATE TABLE IF NOT EXISTS public.campanha_atrio_supressao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone_normalizado TEXT NOT NULL UNIQUE,
  nome_associado TEXT,
  motivo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'audit_atrio_22_05_2026'
);

ALTER TABLE public.campanha_atrio_supressao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_atrio_supressao"
  ON public.campanha_atrio_supressao
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Tabela de auditoria pontual da reparação 22/05/2026
CREATE TABLE IF NOT EXISTS public.audit_log_atrio_22_05_2026 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aprovacao_id UUID NOT NULL,
  lead_id UUID,
  telefone_normalizado TEXT,
  operacao TEXT NOT NULL CHECK (operacao IN ('INATIVAR','OBSERVAR','SUPRIMIR')),
  estado_antes JSONB,
  estado_depois JSONB,
  executado_por TEXT NOT NULL DEFAULT 'CEO Lucas - audit Átrio 22/05',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_atrio_aprovacao ON public.audit_log_atrio_22_05_2026 (aprovacao_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_atrio_lead ON public.audit_log_atrio_22_05_2026 (lead_id);

ALTER TABLE public.audit_log_atrio_22_05_2026 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit_log_atrio"
  ON public.audit_log_atrio_22_05_2026
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));