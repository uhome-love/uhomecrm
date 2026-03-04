
-- Add jetimob_user_id to profiles
ALTER TABLE public.profiles
ADD COLUMN jetimob_user_id text DEFAULT NULL;

-- Add index for lookups
CREATE INDEX idx_profiles_jetimob_user_id ON public.profiles (jetimob_user_id) WHERE jetimob_user_id IS NOT NULL;
