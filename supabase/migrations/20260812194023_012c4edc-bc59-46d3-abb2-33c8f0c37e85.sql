CREATE TABLE public._rollback_pos_visita_2026_08_12 (
  id uuid PRIMARY KEY,
  nome text,
  stage_id uuid,
  corretor_id uuid,
  flag_status jsonb,
  motivo_descarte text,
  motivo_descarte_code text,
  tipo_descarte text,
  stage_changed_at timestamptz,
  ultimo_toque_at timestamptz,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public._rollback_pos_visita_2026_08_12 TO service_role;

ALTER TABLE public._rollback_pos_visita_2026_08_12 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente admin le o backup"
  ON public._rollback_pos_visita_2026_08_12
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));