
-- Fix: Convert restrictive policies to permissive on oferta_ativa_listas
-- Restrictive policies without permissive ones block ALL access

DROP POLICY IF EXISTS "Admins can manage listas" ON public.oferta_ativa_listas;
DROP POLICY IF EXISTS "Corretores can view liberadas" ON public.oferta_ativa_listas;
DROP POLICY IF EXISTS "Gestores can view listas" ON public.oferta_ativa_listas;

CREATE POLICY "Admins can manage listas"
  ON public.oferta_ativa_listas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Corretores can view liberadas"
  ON public.oferta_ativa_listas FOR SELECT
  TO authenticated
  USING (status = 'liberada'::text);

CREATE POLICY "Gestores can view listas"
  ON public.oferta_ativa_listas FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

-- Also fix oferta_ativa_leads policies (same issue)
DROP POLICY IF EXISTS "Admins can manage leads" ON public.oferta_ativa_leads;
DROP POLICY IF EXISTS "Corretores can update assigned leads" ON public.oferta_ativa_leads;
DROP POLICY IF EXISTS "Corretores can view fila leads" ON public.oferta_ativa_leads;
DROP POLICY IF EXISTS "Gestores can view leads" ON public.oferta_ativa_leads;

CREATE POLICY "Admins can manage leads"
  ON public.oferta_ativa_leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Corretores can update assigned leads"
  ON public.oferta_ativa_leads FOR UPDATE
  TO authenticated
  USING (corretor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Corretores can view fila leads"
  ON public.oferta_ativa_leads FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM oferta_ativa_listas l
    WHERE l.id = oferta_ativa_leads.lista_id AND l.status = 'liberada'::text
  ));

CREATE POLICY "Gestores can view leads"
  ON public.oferta_ativa_leads FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role));

-- Also fix oferta_ativa_tentativas
DROP POLICY IF EXISTS "Users can insert own tentativas" ON public.oferta_ativa_tentativas;
DROP POLICY IF EXISTS "Users can view own tentativas" ON public.oferta_ativa_tentativas;

CREATE POLICY "Users can insert own tentativas"
  ON public.oferta_ativa_tentativas FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = corretor_id);

CREATE POLICY "Users can view own tentativas"
  ON public.oferta_ativa_tentativas FOR SELECT
  TO authenticated
  USING (corretor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Fix oferta_ativa_templates
DROP POLICY IF EXISTS "Admins can manage templates" ON public.oferta_ativa_templates;
DROP POLICY IF EXISTS "All authenticated can view templates" ON public.oferta_ativa_templates;

CREATE POLICY "Admins can manage templates"
  ON public.oferta_ativa_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view templates"
  ON public.oferta_ativa_templates FOR SELECT
  TO authenticated
  USING (true);
