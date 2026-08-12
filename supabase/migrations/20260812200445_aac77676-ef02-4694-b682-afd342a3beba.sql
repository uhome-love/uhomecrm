CREATE TABLE IF NOT EXISTS public._rollback_andressa_2026_08_12 (
  lead_id uuid PRIMARY KEY,
  arquivado boolean,
  tipo_descarte text,
  stage_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._rollback_andressa_2026_08_12 TO service_role;
ALTER TABLE public._rollback_andressa_2026_08_12 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_only_rollback_andressa" ON public._rollback_andressa_2026_08_12
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));