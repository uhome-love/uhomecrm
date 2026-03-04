
-- Marketing reports uploaded by users
CREATE TABLE public.marketing_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome_arquivo text NOT NULL,
  canal text NOT NULL DEFAULT 'outros',
  periodo_inicio date,
  periodo_fim date,
  dados_brutos jsonb DEFAULT '[]'::jsonb,
  resumo_ia text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all marketing reports"
ON public.marketing_reports FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert marketing reports"
ON public.marketing_reports FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete marketing reports"
ON public.marketing_reports FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Marketing entries (parsed rows from reports)
CREATE TABLE public.marketing_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid REFERENCES public.marketing_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  canal text NOT NULL DEFAULT 'outros',
  campanha text,
  anuncio text,
  empreendimento text,
  periodo text,
  investimento numeric DEFAULT 0,
  impressoes integer DEFAULT 0,
  cliques integer DEFAULT 0,
  leads_gerados integer DEFAULT 0,
  conversoes integer DEFAULT 0,
  cpl numeric GENERATED ALWAYS AS (CASE WHEN leads_gerados > 0 THEN investimento / leads_gerados ELSE NULL END) STORED,
  cpc numeric GENERATED ALWAYS AS (CASE WHEN cliques > 0 THEN investimento / cliques ELSE NULL END) STORED,
  ctr numeric GENERATED ALWAYS AS (CASE WHEN impressoes > 0 THEN (cliques::numeric / impressoes) * 100 ELSE NULL END) STORED,
  visitas integer DEFAULT 0,
  propostas integer DEFAULT 0,
  vendas integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all marketing entries"
ON public.marketing_entries FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert marketing entries"
ON public.marketing_entries FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update marketing entries"
ON public.marketing_entries FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete marketing entries"
ON public.marketing_entries FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_marketing_entries_updated_at
BEFORE UPDATE ON public.marketing_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
