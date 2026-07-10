CREATE TABLE public.meta_form_names (
  form_id TEXT PRIMARY KEY,
  form_name TEXT,
  fonte TEXT NOT NULL DEFAULT 'graph_api',
  encontrado BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_form_names TO authenticated;
GRANT ALL ON public.meta_form_names TO service_role;

ALTER TABLE public.meta_form_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read meta form names"
ON public.meta_form_names FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meta_form_names_updated_at
BEFORE UPDATE ON public.meta_form_names
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();