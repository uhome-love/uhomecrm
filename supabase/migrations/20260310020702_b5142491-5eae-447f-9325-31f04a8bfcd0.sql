-- Table for public property showcases (vitrines)
CREATE TABLE public.vitrines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Seleção de Imóveis',
  mensagem_corretor text,
  imovel_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_nome text,
  lead_telefone text,
  visualizacoes int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.vitrines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vitrines"
  ON public.vitrines FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Public can view vitrines by id"
  ON public.vitrines FOR SELECT TO anon
  USING (expires_at > now());