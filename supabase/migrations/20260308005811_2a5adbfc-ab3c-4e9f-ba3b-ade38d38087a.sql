
-- Drop existing RLS policies on distribuicao_escala to replace with team-scoped ones
DROP POLICY IF EXISTS "Admins can manage escala" ON public.distribuicao_escala;
DROP POLICY IF EXISTS "Authenticated can view escala" ON public.distribuicao_escala;
DROP POLICY IF EXISTS "Gestores can delete escala" ON public.distribuicao_escala;
DROP POLICY IF EXISTS "Gestores can manage escala" ON public.distribuicao_escala;
DROP POLICY IF EXISTS "Gestores can update escala" ON public.distribuicao_escala;

-- Create a security definer function to check if a corretor belongs to the user's team
CREATE OR REPLACE FUNCTION public.is_corretor_in_my_team(p_corretor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = p_corretor_id
      AND gerente_id = auth.uid()
      AND status = 'ativo'
  )
$$;

-- Admins/CEO: full access
CREATE POLICY "Admins can manage escala"
ON public.distribuicao_escala FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Gestores: can view entries for corretores in their team
CREATE POLICY "Gestores can view team escala"
ON public.distribuicao_escala FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role) 
  AND is_corretor_in_my_team(corretor_id)
);

-- Gestores: can insert entries for corretores in their team
CREATE POLICY "Gestores can insert team escala"
ON public.distribuicao_escala FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  AND is_corretor_in_my_team(corretor_id)
);

-- Gestores: can update entries for corretores in their team
CREATE POLICY "Gestores can update team escala"
ON public.distribuicao_escala FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND is_corretor_in_my_team(corretor_id)
);

-- Gestores: can delete entries for corretores in their team
CREATE POLICY "Gestores can delete team escala"
ON public.distribuicao_escala FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND is_corretor_in_my_team(corretor_id)
);

-- Corretores: can view their own entries (read-only)
CREATE POLICY "Corretores can view own escala"
ON public.distribuicao_escala FOR SELECT
TO authenticated
USING (corretor_id = auth.uid());
