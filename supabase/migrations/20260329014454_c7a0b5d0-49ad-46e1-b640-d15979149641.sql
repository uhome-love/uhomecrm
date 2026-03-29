
-- Helper RPC for Edge Function to sync roleta_fila counters
CREATE OR REPLACE FUNCTION public.increment_roleta_fila(
  p_corretor_profile_id uuid,
  p_segmento_id uuid,
  p_data date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE roleta_fila
  SET leads_recebidos = COALESCE(leads_recebidos, 0) + 1
  WHERE corretor_id = p_corretor_profile_id
    AND segmento_id = p_segmento_id
    AND data = p_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_roleta_fila(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_roleta_fila(uuid, uuid, date) TO service_role;
