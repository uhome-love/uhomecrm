CREATE TABLE public.campanha_natal_metas (
  user_id uuid PRIMARY KEY,
  meta_vgv numeric NOT NULL DEFAULT 1000000 CHECK (meta_vgv >= 1000000),
  meta_visitas_semana integer NOT NULL DEFAULT 3 CHECK (meta_visitas_semana BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.campanha_natal_metas TO authenticated;
GRANT ALL ON public.campanha_natal_metas TO service_role;
ALTER TABLE public.campanha_natal_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "natal metas: dono le" ON public.campanha_natal_metas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "natal metas: dono insere" ON public.campanha_natal_metas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "natal metas: dono altera" ON public.campanha_natal_metas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "natal metas: gestor le equipe" ON public.campanha_natal_metas FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.gerente_id = auth.uid() AND tm.user_id = campanha_natal_metas.user_id AND tm.status = 'ativo')
);
CREATE POLICY "natal metas: direcao le tudo" ON public.campanha_natal_metas FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor')
);