
-- ============================================================
-- FASE 1 — Hardening: remover acesso anônimo a dados sensíveis
-- Rollback rápido (se necessário):
--   CREATE POLICY "Public can view visitas for scoreboard" ON public.visitas FOR SELECT TO anon USING (true);
--   CREATE POLICY "Public can view team_members for scoreboard" ON public.team_members FOR SELECT TO anon USING (true);
--   UPDATE storage.buckets SET public=true WHERE id='temp-imports';
-- ============================================================

-- 1. RPC agregada para o Placar do Dia (anon-safe, sem PII sensível)
CREATE OR REPLACE FUNCTION public.rpc_placar_do_dia()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio timestamptz := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_fim    timestamptz := v_inicio + interval '1 day';
  v_result jsonb;
BEGIN
  WITH membros AS (
    SELECT user_id, gerente_id, nome
    FROM public.team_members
    WHERE status = 'ativo' AND user_id IS NOT NULL
  ),
  visitas_hoje AS (
    SELECT v.id, v.corretor_id, v.created_at, v.status,
           v.nome_cliente, v.data_visita, v.empreendimento,
           m.nome AS corretor_nome, m.gerente_id
    FROM public.visitas v
    JOIN membros m ON m.user_id = v.corretor_id
    WHERE v.created_at >= v_inicio
      AND v.created_at <  v_fim
      AND v.status IN ('marcada','confirmada','realizada','reagendada')
  )
  SELECT jsonb_build_object(
    'membros',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'gerente_id', gerente_id, 'nome', nome
      )), '[]'::jsonb) FROM membros),
    'visitas',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'corretor_id', corretor_id,
        'corretor_nome', corretor_nome,
        'gerente_id', gerente_id,
        'created_at', created_at,
        'status', status,
        'nome_cliente', nome_cliente,
        'data_visita', data_visita,
        'empreendimento', empreendimento
      )), '[]'::jsonb) FROM visitas_hoje),
    'gerado_em', now()
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_placar_do_dia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_placar_do_dia() TO anon, authenticated;

-- 2. Remover policies anônimas perigosas
DROP POLICY IF EXISTS "Public can view visitas for scoreboard" ON public.visitas;
DROP POLICY IF EXISTS "Public can view team_members for scoreboard" ON public.team_members;

-- 3. Bucket temp-imports: tornar privado + policies restritas
UPDATE storage.buckets SET public = false WHERE id = 'temp-imports';

DROP POLICY IF EXISTS "temp_imports_admin_read"   ON storage.objects;
DROP POLICY IF EXISTS "temp_imports_admin_write"  ON storage.objects;
DROP POLICY IF EXISTS "temp_imports_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "temp_imports_admin_delete" ON storage.objects;

CREATE POLICY "temp_imports_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
  )
);

CREATE POLICY "temp_imports_admin_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'temp-imports'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
  )
);

CREATE POLICY "temp_imports_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
  )
);

CREATE POLICY "temp_imports_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'temp-imports'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'backoffice')
  )
);
