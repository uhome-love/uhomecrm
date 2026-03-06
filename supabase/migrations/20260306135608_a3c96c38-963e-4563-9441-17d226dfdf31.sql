
-- Add linkage columns to visitas table
ALTER TABLE public.visitas 
  ADD COLUMN IF NOT EXISTS linked_pdn_id uuid REFERENCES public.pdn_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_to_pdn_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_to_pdn_by uuid;

-- Add linkage column to pdn_entries table
ALTER TABLE public.pdn_entries 
  ADD COLUMN IF NOT EXISTS linked_visit_id uuid REFERENCES public.visitas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_from_visit boolean NOT NULL DEFAULT false;

-- Allow gestores to update visitas of their team
CREATE POLICY "Gestores can update team visitas"
  ON public.visitas
  FOR UPDATE
  USING (gerente_id = auth.uid())
  WITH CHECK (gerente_id = auth.uid());
