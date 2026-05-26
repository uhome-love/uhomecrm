SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP POLICY IF EXISTS "Users can view negocios" ON public.negocios;

CREATE POLICY "negocios_select_scoped"
ON public.negocios FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR auth_user_id = auth.uid()
  OR gerente_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR corretor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR corretor_id IN (
    SELECT p.id FROM public.profiles p
    JOIN public.team_members tm ON tm.user_id = p.user_id
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
  OR EXISTS (
    SELECT 1 FROM public.pipeline_parcerias pp
    WHERE pp.pipeline_lead_id = negocios.pipeline_lead_id
      AND pp.status = 'ativa'
      AND (pp.corretor_principal_id = auth.uid() OR pp.corretor_parceiro_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view own tentativas" ON public.oferta_ativa_tentativas;

CREATE POLICY "oat_select_scoped"
ON public.oferta_ativa_tentativas FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR corretor_id = auth.uid()
  OR corretor_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
);

DROP POLICY IF EXISTS "Corretores can view own tarefas" ON public.pipeline_tarefas;
DROP POLICY IF EXISTS "Corretores can view tasks on their leads" ON public.pipeline_tarefas;
DROP POLICY IF EXISTS "Gestores can manage tarefas" ON public.pipeline_tarefas;

CREATE POLICY "pt_select_scoped"
ON public.pipeline_tarefas FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR pipeline_lead_id IN (SELECT id FROM public.pipeline_leads WHERE corretor_id = auth.uid())
  OR responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
);

CREATE POLICY "pt_admin_all"
ON public.pipeline_tarefas FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "pt_gestor_team_write"
ON public.pipeline_tarefas FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'gestor')
  AND responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gestor')
  AND responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
);

DROP POLICY IF EXISTS "Corretores can view own atividades" ON public.pipeline_atividades;
DROP POLICY IF EXISTS "Gestores can manage atividades" ON public.pipeline_atividades;

CREATE POLICY "pa_select_scoped"
ON public.pipeline_atividades FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR pipeline_lead_id IN (SELECT id FROM public.pipeline_leads WHERE corretor_id = auth.uid())
  OR responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
);

CREATE POLICY "pa_admin_all"
ON public.pipeline_atividades FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "pa_gestor_team_write"
ON public.pipeline_atividades FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'gestor')
  AND responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'gestor')
  AND responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
);