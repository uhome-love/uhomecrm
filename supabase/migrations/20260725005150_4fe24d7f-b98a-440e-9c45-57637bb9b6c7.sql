
CREATE TABLE IF NOT EXISTS public.oferta_ativa_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL,
  cooldown_ate timestamptz,
  resultado text NOT NULL,
  motivo text,
  observacao text,
  criado_por uuid NOT NULL,
  mutirao_bypass boolean NOT NULL DEFAULT false,
  sessao_id uuid,
  lista_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oferta_ativa_cooldowns TO authenticated;
GRANT ALL ON public.oferta_ativa_cooldowns TO service_role;

ALTER TABLE public.oferta_ativa_cooldowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oa_cooldowns_select_authenticated"
  ON public.oferta_ativa_cooldowns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "oa_cooldowns_service_write"
  ON public.oferta_ativa_cooldowns FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_oa_cooldowns_lead_ate
  ON public.oferta_ativa_cooldowns(pipeline_lead_id, cooldown_ate DESC);
CREATE INDEX IF NOT EXISTS idx_oa_cooldowns_criado_por
  ON public.oferta_ativa_cooldowns(criado_por, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oa_cooldowns_perm
  ON public.oferta_ativa_cooldowns(pipeline_lead_id)
  WHERE cooldown_ate IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at_oa_cooldowns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oa_cooldowns_updated_at ON public.oferta_ativa_cooldowns;
CREATE TRIGGER trg_oa_cooldowns_updated_at
  BEFORE UPDATE ON public.oferta_ativa_cooldowns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_oa_cooldowns();

CREATE OR REPLACE FUNCTION public.oferta_ativa_esta_em_cooldown(
  p_pipeline_lead_id uuid,
  p_corretor_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.oferta_ativa_cooldowns c
    WHERE c.pipeline_lead_id = p_pipeline_lead_id
      AND (c.cooldown_ate IS NULL OR c.cooldown_ate > now())
      AND c.criado_por <> p_corretor_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.oferta_ativa_esta_em_cooldown(uuid, uuid) TO authenticated, service_role;
