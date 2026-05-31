-- Reforço de permissões do gestor no pipeline de leads:
-- garante INSERT do gestor e permite gestor ver/editar leads que ele mesmo criou.

-- INSERT do gestor (recria idempotente)
DROP POLICY IF EXISTS "Gestores can insert pipeline leads" ON public.pipeline_leads;
CREATE POLICY "Gestores can insert pipeline leads"
ON public.pipeline_leads
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- SELECT do gestor: leads da equipe OU leads que ele mesmo criou
DROP POLICY IF EXISTS "Gestores can view team pipeline leads" ON public.pipeline_leads;
CREATE POLICY "Gestores can view team pipeline leads"
ON public.pipeline_leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND (
    (corretor_id IS NOT NULL AND is_lead_in_my_team(corretor_id))
    OR created_by = auth.uid()
  )
);

-- UPDATE do gestor: leads da equipe OU leads que ele mesmo criou
DROP POLICY IF EXISTS "Gestores can update team pipeline leads" ON public.pipeline_leads;
CREATE POLICY "Gestores can update team pipeline leads"
ON public.pipeline_leads
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gestor'::app_role)
    AND (
      (corretor_id IS NOT NULL AND is_lead_in_my_team(corretor_id))
      OR created_by = auth.uid()
    )
  )
);