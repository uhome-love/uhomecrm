
-- 1. Create SECURITY DEFINER function to check if current user is a partner on a given lead
CREATE OR REPLACE FUNCTION public.is_my_partner_lead(p_pipeline_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pipeline_parcerias
    WHERE pipeline_lead_id = p_pipeline_lead_id
      AND status = 'ativa'
      AND (corretor_principal_id = auth.uid() OR corretor_parceiro_id = auth.uid())
  )
$$;

-- 2. PIPELINE_LEADS: Add SELECT policy for partners
CREATE POLICY "Partners can view partner leads"
ON public.pipeline_leads
FOR SELECT
TO authenticated
USING (public.is_my_partner_lead(id));

-- 3. PIPELINE_LEADS: Add UPDATE policy for partners
CREATE POLICY "Partners can update partner leads"
ON public.pipeline_leads
FOR UPDATE
TO authenticated
USING (public.is_my_partner_lead(id));

-- 4. VISITAS: Add SELECT policy for partners (via pipeline_lead_id)
CREATE POLICY "Partners can view partner visitas"
ON public.visitas
FOR SELECT
TO authenticated
USING (pipeline_lead_id IS NOT NULL AND public.is_my_partner_lead(pipeline_lead_id));

-- 5. VISITAS: Add UPDATE policy for partners
CREATE POLICY "Partners can update partner visitas"
ON public.visitas
FOR UPDATE
TO authenticated
USING (pipeline_lead_id IS NOT NULL AND public.is_my_partner_lead(pipeline_lead_id));

-- 6. VISITAS: Add INSERT policy for partners
CREATE POLICY "Partners can insert partner visitas"
ON public.visitas
FOR INSERT
TO authenticated
WITH CHECK (pipeline_lead_id IS NOT NULL AND public.is_my_partner_lead(pipeline_lead_id));

-- 7. VISITAS: Add DELETE policy for partners
CREATE POLICY "Partners can delete partner visitas"
ON public.visitas
FOR DELETE
TO authenticated
USING (pipeline_lead_id IS NOT NULL AND public.is_my_partner_lead(pipeline_lead_id));

-- 8. NEGOCIOS: Create function to check partner via negocios.pipeline_lead_id
CREATE OR REPLACE FUNCTION public.is_my_partner_negocio(p_pipeline_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p_pipeline_lead_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.pipeline_parcerias
      WHERE pipeline_lead_id = p_pipeline_lead_id
        AND status = 'ativa'
        AND (corretor_principal_id = auth.uid() OR corretor_parceiro_id = auth.uid())
    )
  END
$$;
