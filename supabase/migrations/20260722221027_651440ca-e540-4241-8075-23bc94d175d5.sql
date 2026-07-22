
-- Fase 4: Favoritos e Recentes do corretor no Hub de Materiais

-- 1) Favoritos: corretor marca material como favorito
CREATE TABLE IF NOT EXISTS public.materiais_favoritos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais_links(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_favoritos_user ON public.materiais_favoritos(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.materiais_favoritos TO authenticated;
GRANT ALL ON public.materiais_favoritos TO service_role;

ALTER TABLE public.materiais_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia próprios favoritos"
  ON public.materiais_favoritos
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Recentes: log leve de aberturas/visualizações
CREATE TABLE IF NOT EXISTS public.materiais_recentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materiais_links(id) ON DELETE CASCADE,
  acao TEXT NOT NULL DEFAULT 'abrir', -- abrir | download | copiar | whatsapp | preview
  last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 1,
  UNIQUE (user_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_materiais_recentes_user ON public.materiais_recentes(user_id, last_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_recentes TO authenticated;
GRANT ALL ON public.materiais_recentes TO service_role;

ALTER TABLE public.materiais_recentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia próprios recentes"
  ON public.materiais_recentes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3) RPC para registrar recente com upsert (incrementa count + atualiza timestamp)
CREATE OR REPLACE FUNCTION public.registrar_material_recente(
  _material_id UUID,
  _acao TEXT DEFAULT 'abrir'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.materiais_recentes (user_id, material_id, acao, last_at, count)
    VALUES (auth.uid(), _material_id, _acao, now(), 1)
  ON CONFLICT (user_id, material_id)
    DO UPDATE SET last_at = now(), count = public.materiais_recentes.count + 1, acao = EXCLUDED.acao;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_material_recente(UUID, TEXT) TO authenticated;
