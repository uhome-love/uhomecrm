
-- 1) Fix profiles: replace overly permissive SELECT policy with restrictive ones
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins and gestores can view all profiles (needed for team management)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
