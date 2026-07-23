
CREATE OR REPLACE FUNCTION public.oferta_ativa_lock_next_lead(
  p_sessao_id uuid,
  p_corretor_id uuid,
  p_empreendimento_ids uuid[] DEFAULT '{}',
  p_segmento_ids uuid[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  pipeline_lead_id uuid,
  balde text,
  bucket_order integer,
  empreendimento_id uuid,
  segmento_id uuid,
  motivo_descarte_raw text,
  reengajamento_status_raw text,
  locked_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_until timestamptz := now() + interval '15 minutes';
  v_id uuid;
BEGIN
  SELECT f.id
  INTO v_id
  FROM public.oferta_ativa_fila f
  WHERE f.sessao_id = p_sessao_id
    AND (f.locked_by IS NULL OR f.locked_until <= now())
    AND (f.claimed_by IS NULL OR f.claimed_until <= now())
    AND (f.cooldown_ate IS NULL OR f.cooldown_ate <= now())
    AND (f.ultimo_corretor_id IS NULL OR f.ultimo_corretor_id <> p_corretor_id)
    AND (array_length(p_empreendimento_ids, 1) IS NULL OR f.empreendimento_id = ANY(p_empreendimento_ids))
    AND (array_length(p_segmento_ids, 1) IS NULL OR f.segmento_id = ANY(p_segmento_ids))
  ORDER BY f.bucket_order ASC, f.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.oferta_ativa_fila f
  SET
    locked_by = p_corretor_id,
    locked_until = v_lock_until,
    ultimo_oferecido_em = now(),
    updated_at = now()
  WHERE f.id = v_id
  RETURNING
    f.id,
    f.pipeline_lead_id,
    f.balde,
    f.bucket_order,
    f.empreendimento_id,
    f.segmento_id,
    f.motivo_descarte_raw,
    f.reengajamento_status_raw,
    f.locked_until;
END;
$$;

GRANT EXECUTE ON FUNCTION public.oferta_ativa_lock_next_lead(uuid, uuid, uuid[], uuid[]) TO authenticated, service_role;
