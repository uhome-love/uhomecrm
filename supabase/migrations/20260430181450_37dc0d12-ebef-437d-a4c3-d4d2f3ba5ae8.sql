CREATE TABLE IF NOT EXISTS public.jetimob_corretores (
  id_jetimob BIGINT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  telefone2 TEXT,
  whatsapp BOOLEAN DEFAULT false,
  cargo TEXT,
  creci TEXT,
  equipe TEXT,
  cidade TEXT,
  estado TEXT,
  avatar_url TEXT,
  mostrar_site BOOLEAN DEFAULT true,
  payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jetimob_corretores_nome ON public.jetimob_corretores(nome);

ALTER TABLE public.jetimob_corretores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view jetimob corretores"
  ON public.jetimob_corretores FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_jetimob_corretores_updated_at
  BEFORE UPDATE ON public.jetimob_corretores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();