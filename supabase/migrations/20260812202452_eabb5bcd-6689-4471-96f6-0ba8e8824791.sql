CREATE TABLE public._rollback_leo_2026_08_12 (
  id uuid PRIMARY KEY,
  corretor_id uuid,
  stage_id uuid,
  arquivado boolean,
  motivo_descarte text,
  tipo_descarte text,
  flag_status jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public._rollback_leo_2026_08_12 TO service_role;
ALTER TABLE public._rollback_leo_2026_08_12 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public._rollback_leo_2026_08_12 FOR SELECT USING (false);