
-- Add confirmation_token column to visitas table
ALTER TABLE public.visitas 
ADD COLUMN IF NOT EXISTS confirmation_token uuid DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancel_reason text;

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_visitas_confirmation_token ON public.visitas(confirmation_token);

-- Allow public (anon) read access to visitas by confirmation_token for the public page
CREATE POLICY "Public can view visita by token"
ON public.visitas
FOR SELECT
TO anon
USING (confirmation_token IS NOT NULL);

-- Allow public (anon) to update visita status via token
CREATE POLICY "Public can update visita by token"
ON public.visitas
FOR UPDATE
TO anon
USING (confirmation_token IS NOT NULL)
WITH CHECK (confirmation_token IS NOT NULL);
