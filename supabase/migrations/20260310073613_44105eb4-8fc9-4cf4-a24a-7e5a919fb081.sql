
-- Enable RLS on all public tables missing it
ALTER TABLE public.academia_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_quiz_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleta_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleta_credenciamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleta_distribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleta_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleta_segmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_backup ENABLE ROW LEVEL SECURITY;

-- ACADEMIA: Public read for authenticated
CREATE POLICY "Authenticated can read aulas" ON public.academia_aulas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read checklist" ON public.academia_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read quiz" ON public.academia_quiz FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read quiz_perguntas" ON public.academia_quiz_perguntas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read trilhas" ON public.academia_trilhas FOR SELECT TO authenticated USING (true);

-- Academia write: only admins/gestores
CREATE POLICY "Admins can manage aulas" ON public.academia_aulas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can update aulas" ON public.academia_aulas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete aulas" ON public.academia_aulas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can manage checklist" ON public.academia_checklist FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can update checklist" ON public.academia_checklist FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete checklist" ON public.academia_checklist FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can manage quiz" ON public.academia_quiz FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can update quiz" ON public.academia_quiz FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete quiz" ON public.academia_quiz FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can manage quiz_perguntas" ON public.academia_quiz_perguntas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can update quiz_perguntas" ON public.academia_quiz_perguntas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete quiz_perguntas" ON public.academia_quiz_perguntas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can manage trilhas" ON public.academia_trilhas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can update trilhas" ON public.academia_trilhas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete trilhas" ON public.academia_trilhas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- ROLETA: Authenticated can read, admins/gestores can write
CREATE POLICY "Authenticated read roleta_campanhas" ON public.roleta_campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write roleta_campanhas" ON public.roleta_campanhas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins update roleta_campanhas" ON public.roleta_campanhas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins delete roleta_campanhas" ON public.roleta_campanhas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated read roleta_credenciamentos" ON public.roleta_credenciamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write roleta_credenciamentos" ON public.roleta_credenciamentos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins update roleta_credenciamentos" ON public.roleta_credenciamentos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins delete roleta_credenciamentos" ON public.roleta_credenciamentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated read roleta_distribuicoes" ON public.roleta_distribuicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write roleta_distribuicoes" ON public.roleta_distribuicoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins update roleta_distribuicoes" ON public.roleta_distribuicoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins delete roleta_distribuicoes" ON public.roleta_distribuicoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated read roleta_fila" ON public.roleta_fila FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write roleta_fila" ON public.roleta_fila FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins update roleta_fila" ON public.roleta_fila FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins delete roleta_fila" ON public.roleta_fila FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated read roleta_segmentos" ON public.roleta_segmentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write roleta_segmentos" ON public.roleta_segmentos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins update roleta_segmentos" ON public.roleta_segmentos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins delete roleta_segmentos" ON public.roleta_segmentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- LEADS_BACKUP: Admin only
CREATE POLICY "Only admins access leads_backup" ON public.leads_backup FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins insert leads_backup" ON public.leads_backup FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins update leads_backup" ON public.leads_backup FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins delete leads_backup" ON public.leads_backup FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
