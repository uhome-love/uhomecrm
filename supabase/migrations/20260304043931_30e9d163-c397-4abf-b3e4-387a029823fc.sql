
CREATE TABLE public.ceo_metas_mensais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gerente_id UUID NOT NULL,
  mes TEXT NOT NULL, -- formato 'YYYY-MM'
  meta_vgv_assinado NUMERIC NOT NULL DEFAULT 0,
  meta_visitas_marcadas INTEGER NOT NULL DEFAULT 0,
  meta_visitas_realizadas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gerente_id, mes)
);

ALTER TABLE public.ceo_metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ceo metas" ON public.ceo_metas_mensais FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert ceo metas" ON public.ceo_metas_mensais FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update ceo metas" ON public.ceo_metas_mensais FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete ceo metas" ON public.ceo_metas_mensais FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Gerentes podem ver suas próprias metas
CREATE POLICY "Gerentes can view own metas" ON public.ceo_metas_mensais FOR SELECT USING (auth.uid() = gerente_id);
