
-- Table for Melnick Day campaign daily tracking
CREATE TABLE public.melnick_metas_diarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gerente_id UUID NOT NULL,
  gerente_nome TEXT,
  data DATE NOT NULL,
  prospects INTEGER DEFAULT 0,
  interessados INTEGER DEFAULT 0,
  pastas_montagem INTEGER DEFAULT 0,
  pastas_completas INTEGER DEFAULT 0,
  negocios_projetados INTEGER DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gerente_id, data)
);

ALTER TABLE public.melnick_metas_diarias ENABLE ROW LEVEL SECURITY;

-- Gestors can read all records (for comparisons)
CREATE POLICY "gestors_select_all" ON public.melnick_metas_diarias
  FOR SELECT TO authenticated USING (true);

-- Gestors can insert their own records
CREATE POLICY "gestors_insert_own" ON public.melnick_metas_diarias
  FOR INSERT TO authenticated WITH CHECK (gerente_id = auth.uid());

-- Gestors can update their own records
CREATE POLICY "gestors_update_own" ON public.melnick_metas_diarias
  FOR UPDATE TO authenticated USING (gerente_id = auth.uid()) WITH CHECK (gerente_id = auth.uid());

-- Admins can do everything
CREATE POLICY "admins_all" ON public.melnick_metas_diarias
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
