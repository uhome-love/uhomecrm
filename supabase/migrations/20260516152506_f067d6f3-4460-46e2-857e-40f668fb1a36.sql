
DROP POLICY IF EXISTS "Authenticated users can read whatsapp_ai_log" ON public.whatsapp_ai_log;
CREATE POLICY "Admin/gestor read whatsapp_ai_log"
ON public.whatsapp_ai_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "read_voice_call_logs" ON public.voice_call_logs;
CREATE POLICY "Admin/gestor read voice_call_logs"
ON public.voice_call_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Authenticated users can read ia_call_results" ON public.ia_call_results;
CREATE POLICY "Admin/gestor read ia_call_results"
ON public.ia_call_results FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "auth read meta disparos" ON public.reengajamento_meta_disparos;
CREATE POLICY "Admin/gestor read meta disparos"
ON public.reengajamento_meta_disparos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Authenticated users can read site_events" ON public.site_events;
CREATE POLICY "Admin/gestor read site_events"
ON public.site_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Service role full access on ai_calls" ON public.ai_calls;
CREATE POLICY "Service role full access on ai_calls"
ON public.ai_calls FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE POLICY "Admin/gestor read ai_calls"
ON public.ai_calls FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
