
-- Table for funnel entries (macro data per period per manager)
CREATE TABLE public.funnel_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gerente_id uuid NOT NULL,
  periodo_tipo text NOT NULL DEFAULT 'diario', -- diario, semanal, mensal, customizado
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  leads_gerados integer NOT NULL DEFAULT 0,
  propostas_geradas integer NOT NULL DEFAULT 0,
  vendas_fechadas integer NOT NULL DEFAULT 0,
  vgv_vendido numeric NOT NULL DEFAULT 0,
  investimento_midia numeric NOT NULL DEFAULT 0,
  custo_medio_lead numeric NOT NULL DEFAULT 25,
  observacoes text,
  -- Calculated fields stored for history
  taxa_proposta numeric GENERATED ALWAYS AS (CASE WHEN leads_gerados > 0 THEN ROUND((propostas_geradas::numeric / leads_gerados) * 100, 1) ELSE 0 END) STORED,
  taxa_venda numeric GENERATED ALWAYS AS (CASE WHEN leads_gerados > 0 THEN ROUND((vendas_fechadas::numeric / leads_gerados) * 100, 1) ELSE 0 END) STORED,
  taxa_fechamento numeric GENERATED ALWAYS AS (CASE WHEN propostas_geradas > 0 THEN ROUND((vendas_fechadas::numeric / propostas_geradas) * 100, 1) ELSE 0 END) STORED,
  cpl_real numeric GENERATED ALWAYS AS (CASE WHEN leads_gerados > 0 THEN ROUND(investimento_midia / leads_gerados, 2) ELSE 0 END) STORED,
  cac_estimado numeric GENERATED ALWAYS AS (CASE WHEN vendas_fechadas > 0 THEN ROUND(investimento_midia / vendas_fechadas, 2) ELSE 0 END) STORED,
  analise_ia text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_funnel_entries_gerente_periodo ON public.funnel_entries (gerente_id, periodo_inicio DESC);

-- Enable RLS
ALTER TABLE public.funnel_entries ENABLE ROW LEVEL SECURITY;

-- Gerentes can manage own entries
CREATE POLICY "Gerentes can view own funnel entries"
  ON public.funnel_entries FOR SELECT
  USING (auth.uid() = gerente_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can insert own funnel entries"
  ON public.funnel_entries FOR INSERT
  WITH CHECK (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can update own funnel entries"
  ON public.funnel_entries FOR UPDATE
  USING (auth.uid() = gerente_id);

CREATE POLICY "Gerentes can delete own funnel entries"
  ON public.funnel_entries FOR DELETE
  USING (auth.uid() = gerente_id);

-- Trigger for updated_at
CREATE TRIGGER update_funnel_entries_updated_at
  BEFORE UPDATE ON public.funnel_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
