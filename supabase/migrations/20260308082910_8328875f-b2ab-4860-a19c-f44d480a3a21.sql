
CREATE TABLE IF NOT EXISTS public.pagadoria_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pagadoria_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pagadoria_config"
  ON public.pagadoria_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage pagadoria_config"
  ON public.pagadoria_config FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'))
  );

-- Add unique constraint on tipo to allow upsert
CREATE UNIQUE INDEX IF NOT EXISTS pagadoria_config_tipo_unique ON public.pagadoria_config (tipo);

-- Seed default config
INSERT INTO public.pagadoria_config (tipo, config) VALUES
  ('corretor', '{"faixas": [{"vgv_max": 1500000, "percentual": 30}, {"vgv_max": 3000000, "percentual": 35}, {"vgv_max": null, "percentual": 40}]}'),
  ('gerente', '{"faixas": [{"vgv_max": null, "percentual": 10}]}'),
  ('credores_fixos', '{"credores": [{"nome": "Diretoria", "tipo": "diretoria", "percentual": 5}, {"nome": "Lucas", "tipo": "socio", "percentual": 5}, {"nome": "Gabrielle", "tipo": "socio", "percentual": 5}, {"nome": "Ana Mkt", "tipo": "marketing", "percentual": 1}]}')
ON CONFLICT (tipo) DO NOTHING;
