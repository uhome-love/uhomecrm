
-- Add modulo_atual and negocio_id to pipeline_leads
ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS modulo_atual TEXT NOT NULL DEFAULT 'pipeline',
  ADD COLUMN IF NOT EXISTS negocio_id UUID REFERENCES public.negocios(id),
  ADD COLUMN IF NOT EXISTS ultima_acao_at TIMESTAMPTZ DEFAULT now();

-- Add fase_changed_at to negocios for tracking days in phase
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS fase_changed_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pipeline_lead_id UUID;

-- Create trigger function: auto-update ultima_acao_at on pipeline_leads changes
CREATE OR REPLACE FUNCTION public.update_lead_ultima_acao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  NEW.ultima_acao_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lead_ultima_acao ON public.pipeline_leads;
CREATE TRIGGER trg_update_lead_ultima_acao
  BEFORE UPDATE ON public.pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_ultima_acao();

-- Create trigger function: auto-update fase_changed_at on negocios phase change
CREATE OR REPLACE FUNCTION public.update_negocio_fase_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF OLD.fase IS DISTINCT FROM NEW.fase THEN
    NEW.fase_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_negocio_fase_changed ON public.negocios;
CREATE TRIGGER trg_negocio_fase_changed
  BEFORE UPDATE ON public.negocios
  FOR EACH ROW EXECUTE FUNCTION public.update_negocio_fase_changed();

-- RLS policies for negocios (allow authenticated users to manage)
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view negocios" ON public.negocios;
CREATE POLICY "Users can view negocios" ON public.negocios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert negocios" ON public.negocios;
CREATE POLICY "Users can insert negocios" ON public.negocios
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update negocios" ON public.negocios;
CREATE POLICY "Users can update negocios" ON public.negocios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS for pos_vendas
ALTER TABLE public.pos_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pos_vendas" ON public.pos_vendas;
CREATE POLICY "Users can view pos_vendas" ON public.pos_vendas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert pos_vendas" ON public.pos_vendas;
CREATE POLICY "Users can insert pos_vendas" ON public.pos_vendas
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS for lead_progressao
ALTER TABLE public.lead_progressao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view lead_progressao" ON public.lead_progressao;
CREATE POLICY "Users can view lead_progressao" ON public.lead_progressao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert lead_progressao" ON public.lead_progressao;
CREATE POLICY "Users can insert lead_progressao" ON public.lead_progressao
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable realtime for negocios
ALTER PUBLICATION supabase_realtime ADD TABLE public.negocios;
