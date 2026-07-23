-- Remover link comercial e favoritos por material; criar favoritos por empreendimento

-- 1) Drop tabela materiais_shares (link comercial descontinuado)
DROP TABLE IF EXISTS public.materiais_shares CASCADE;

-- 2) Drop tabela materiais_favoritos (favorito por material substituído por empreendimento)
DROP TABLE IF EXISTS public.materiais_favoritos CASCADE;

-- 3) Nova tabela: favoritos por empreendimento
CREATE TABLE public.empreendimentos_favoritos (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empreendimento_id uuid NOT NULL REFERENCES public.materiais_empreendimentos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, empreendimento_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empreendimentos_favoritos TO authenticated;
GRANT ALL ON public.empreendimentos_favoritos TO service_role;

ALTER TABLE public.empreendimentos_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own empreendimento favorites"
ON public.empreendimentos_favoritos FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_empreendimentos_favoritos_user ON public.empreendimentos_favoritos(user_id);