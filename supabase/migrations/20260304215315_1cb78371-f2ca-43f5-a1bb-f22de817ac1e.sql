
-- Add user_id column to team_members to link with actual system users
ALTER TABLE public.team_members 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique index to prevent duplicate user links per gerente
CREATE UNIQUE INDEX team_members_user_id_gerente_id_idx 
ON public.team_members (user_id, gerente_id) 
WHERE user_id IS NOT NULL;
