-- 1) Gestor passa a ver atividades dos leads da própria equipe (por dono do lead)
DROP POLICY IF EXISTS "pa_select_scoped" ON public.pipeline_atividades;
CREATE POLICY "pa_select_scoped" ON public.pipeline_atividades
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR responsavel_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.pipeline_leads pl
    WHERE pl.id = pipeline_atividades.pipeline_lead_id
      AND pl.corretor_id = auth.uid()
  )
  OR responsavel_id IN (
    SELECT tm.user_id FROM public.team_members tm
    WHERE tm.gerente_id = auth.uid() AND tm.status = 'ativo'
  )
  OR EXISTS (
    SELECT 1
    FROM public.pipeline_leads pl
    JOIN public.team_members tm ON tm.user_id = pl.corretor_id
    WHERE pl.id = pipeline_atividades.pipeline_lead_id
      AND tm.gerente_id = auth.uid()
      AND tm.status = 'ativo'
  )
);

-- 2) Preencher responsavel_id automaticamente nos registros novos
CREATE OR REPLACE FUNCTION public.trg_pa_default_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    SELECT pl.corretor_id INTO NEW.responsavel_id
    FROM public.pipeline_leads pl
    WHERE pl.id = NEW.pipeline_lead_id;
  END IF;
  IF NEW.responsavel_id IS NULL THEN
    NEW.responsavel_id := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pa_default_responsavel ON public.pipeline_atividades;
CREATE TRIGGER pa_default_responsavel
BEFORE INSERT ON public.pipeline_atividades
FOR EACH ROW EXECUTE FUNCTION public.trg_pa_default_responsavel();

-- 3) Backfill do responsável nas atividades antigas
UPDATE public.pipeline_atividades a
SET responsavel_id = pl.corretor_id
FROM public.pipeline_leads pl
WHERE pl.id = a.pipeline_lead_id
  AND a.responsavel_id IS NULL
  AND pl.corretor_id IS NOT NULL;