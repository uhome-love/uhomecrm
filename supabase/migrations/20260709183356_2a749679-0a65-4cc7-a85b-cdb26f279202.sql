-- =========================================================
-- Vendas Realizadas: comissão manual + metas mensais
-- =========================================================

-- 1) Comissão manual por venda (preenchida pelo corretor)
CREATE TABLE public.venda_comissoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_comissoes TO authenticated;
GRANT ALL ON public.venda_comissoes TO service_role;

ALTER TABLE public.venda_comissoes ENABLE ROW LEVEL SECURITY;

-- Dono: gerencia a própria comissão
CREATE POLICY "Usuário gerencia própria comissão"
  ON public.venda_comissoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin: vê tudo
CREATE POLICY "Admin vê todas comissões"
  ON public.venda_comissoes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Gestor: vê comissões dos membros da sua equipe
CREATE POLICY "Gestor vê comissões do time"
  ON public.venda_comissoes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.user_id = venda_comissoes.user_id
  ));

-- 2) Meta mensal pessoal do corretor
CREATE TABLE public.corretor_metas_mensais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes text NOT NULL, -- 'YYYY-MM'
  meta_vgv numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretor_metas_mensais TO authenticated;
GRANT ALL ON public.corretor_metas_mensais TO service_role;

ALTER TABLE public.corretor_metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia própria meta"
  ON public.corretor_metas_mensais FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin vê todas metas de corretor"
  ON public.corretor_metas_mensais FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestor vê metas do time"
  ON public.corretor_metas_mensais FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.user_id = corretor_metas_mensais.user_id
  ));

-- 3) Meta mensal da empresa (preenchida pelo admin)
CREATE TABLE public.empresa_metas_mensais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes text NOT NULL UNIQUE, -- 'YYYY-MM'
  meta_vgv numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_metas_mensais TO authenticated;
GRANT ALL ON public.empresa_metas_mensais TO service_role;

ALTER TABLE public.empresa_metas_mensais ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver a meta da empresa
CREATE POLICY "Autenticados veem meta da empresa"
  ON public.empresa_metas_mensais FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admin edita
CREATE POLICY "Admin insere meta da empresa"
  ON public.empresa_metas_mensais FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin atualiza meta da empresa"
  ON public.empresa_metas_mensais FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin deleta meta da empresa"
  ON public.empresa_metas_mensais FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Trigger updated_at (reaproveita função padrão se existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_venda_comissoes_updated
  BEFORE UPDATE ON public.venda_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_corretor_metas_updated
  BEFORE UPDATE ON public.corretor_metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_empresa_metas_updated
  BEFORE UPDATE ON public.empresa_metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();