CREATE TABLE public.lia_laboratorio_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cenario_id text NOT NULL,
  produto_slug text,
  conversa jsonb NOT NULL DEFAULT '[]'::jsonb,
  conferencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  sinal_final text,
  passou_automatico boolean NOT NULL DEFAULT false,
  avaliacao text,
  comentario text,
  avaliado_por uuid,
  avaliado_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lia_lab_exec_cenario_idx ON public.lia_laboratorio_execucoes (cenario_id, created_at DESC);
GRANT SELECT, UPDATE ON public.lia_laboratorio_execucoes TO authenticated;
GRANT ALL ON public.lia_laboratorio_execucoes TO service_role;
ALTER TABLE public.lia_laboratorio_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab lia leitura direcao" ON public.lia_laboratorio_execucoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "lab lia avaliacao direcao" ON public.lia_laboratorio_execucoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor'));