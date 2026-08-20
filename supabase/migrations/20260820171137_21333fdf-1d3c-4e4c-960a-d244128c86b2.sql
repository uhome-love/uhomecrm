CREATE OR REPLACE FUNCTION public.set_empreendimento_segmento(p_empreendimento_id uuid, p_segmento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretor'::app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas CEO/Admin/Diretor pode alterar o segmento de empreendimento';
  END IF;

  IF p_segmento_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.roleta_segmentos WHERE id = p_segmento_id) THEN
    RAISE EXCEPTION 'Segmento inválido';
  END IF;

  UPDATE public.empreendimentos_canonicos
  SET segmento_id = p_segmento_id,
      updated_at = now()
  WHERE id = p_empreendimento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_empreendimento_segmento(uuid, uuid) TO authenticated;