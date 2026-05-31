-- Remove unsafe anon policies on visitas. The public visit confirmation page
-- uses the `visita-public` edge function (service role), so these anon policies
-- are not used by the app and currently expose all visit rows to anon.
DROP POLICY IF EXISTS "Public can view visita by token" ON public.visitas;
DROP POLICY IF EXISTS "Public can update visita by token" ON public.visitas;