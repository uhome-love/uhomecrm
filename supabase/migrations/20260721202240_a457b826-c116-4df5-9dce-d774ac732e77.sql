
ALTER TABLE public.empreendimentos_canonicos
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

UPDATE public.empreendimentos_canonicos ec
SET ativo = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_leads pl
  WHERE pl.empreendimento_canonico_id = ec.id
    AND pl.created_at >= (now() - interval '90 days')
);

CREATE OR REPLACE FUNCTION public.set_empreendimento_ativo(
  p_empreendimento_id UUID,
  p_ativo BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas CEO/Admin/Diretor pode alterar status de empreendimento';
  END IF;

  UPDATE public.empreendimentos_canonicos
  SET ativo = p_ativo,
      updated_at = now()
  WHERE id = p_empreendimento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_empreendimento_ativo(UUID, BOOLEAN) TO authenticated;
