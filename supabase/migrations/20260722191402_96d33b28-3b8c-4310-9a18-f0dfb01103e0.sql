CREATE TABLE public.materiais_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empreendimento_slug text NOT NULL,
  empreendimento_nome text,
  titulo text,
  mensagem text,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  views integer NOT NULL DEFAULT 0,
  cliques integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_materiais_shares_corretor ON public.materiais_shares(corretor_id);
CREATE INDEX idx_materiais_shares_empreendimento ON public.materiais_shares(empreendimento_slug);
CREATE INDEX idx_materiais_shares_created ON public.materiais_shares(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_shares TO authenticated;
GRANT ALL ON public.materiais_shares TO service_role;

ALTER TABLE public.materiais_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corretor_gerencia_seus_shares"
ON public.materiais_shares
FOR ALL
TO authenticated
USING (corretor_id = auth.uid())
WITH CHECK (corretor_id = auth.uid());

CREATE POLICY "gestao_ve_todos_shares"
ON public.materiais_shares
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

CREATE TRIGGER trg_materiais_shares_updated_at
BEFORE UPDATE ON public.materiais_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();