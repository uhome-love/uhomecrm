CREATE POLICY "Authenticated can insert ops_events"
ON public.ops_events
FOR INSERT
TO authenticated
WITH CHECK (true);