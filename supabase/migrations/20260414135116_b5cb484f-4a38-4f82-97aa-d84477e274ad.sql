-- 1. Fix jetimob_processed: remove overly permissive public policy
DROP POLICY IF EXISTS "Service role full access" ON public.jetimob_processed;
CREATE POLICY "Authenticated can read jetimob_processed"
  ON public.jetimob_processed FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access jetimob_processed"
  ON public.jetimob_processed FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Fix pulse_events: restrict INSERT to own corretor_id
DROP POLICY IF EXISTS "pulse_events_insert" ON public.pulse_events;
CREATE POLICY "pulse_events_insert_own"
  ON public.pulse_events FOR INSERT TO authenticated
  WITH CHECK (corretor_id = auth.uid());

-- 3. Fix pulse_desafios: restrict INSERT to admin/gestor, UPDATE to creator or admin
DROP POLICY IF EXISTS "pulse_desafios_insert" ON public.pulse_desafios;
DROP POLICY IF EXISTS "pulse_desafios_update" ON public.pulse_desafios;
CREATE POLICY "pulse_desafios_insert_restricted"
  ON public.pulse_desafios FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR criado_por = auth.uid());
CREATE POLICY "pulse_desafios_update_restricted"
  ON public.pulse_desafios FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Fix pulse_desafio_contribuicoes: restrict INSERT to own corretor_id
DROP POLICY IF EXISTS "pulse_contribuicoes_insert" ON public.pulse_desafio_contribuicoes;
CREATE POLICY "pulse_contribuicoes_insert_own"
  ON public.pulse_desafio_contribuicoes FOR INSERT TO authenticated
  WITH CHECK (corretor_id = auth.uid());

-- 5. Fix empreendimento_fichas: restrict INSERT/UPDATE to admin only
DROP POLICY IF EXISTS "empreendimento_fichas_insert" ON public.empreendimento_fichas;
DROP POLICY IF EXISTS "empreendimento_fichas_update" ON public.empreendimento_fichas;
CREATE POLICY "empreendimento_fichas_insert_admin"
  ON public.empreendimento_fichas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "empreendimento_fichas_update_admin"
  ON public.empreendimento_fichas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Fix storage: restrict upload/delete on academia buckets to admin/gestor
DROP POLICY IF EXISTS "Authenticated upload academia videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete academia videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload academia pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete academia pdfs" ON storage.objects;

CREATE POLICY "Admin/gestor upload academia videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academia-videos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

CREATE POLICY "Admin/gestor delete academia videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'academia-videos'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

CREATE POLICY "Admin/gestor upload academia pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academia-pdfs'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));

CREATE POLICY "Admin/gestor delete academia pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'academia-pdfs'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')));
