
-- Security definer function to get profile.id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_profile_id_for_auth()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Fix academia_progresso RLS policies
DROP POLICY IF EXISTS "Users can insert own progress" ON public.academia_progresso;
DROP POLICY IF EXISTS "Users can update own progress" ON public.academia_progresso;
DROP POLICY IF EXISTS "Users can view own progress" ON public.academia_progresso;

CREATE POLICY "Users can view own progress" ON public.academia_progresso
  FOR SELECT USING (corretor_id = public.get_profile_id_for_auth());

CREATE POLICY "Users can insert own progress" ON public.academia_progresso
  FOR INSERT WITH CHECK (corretor_id = public.get_profile_id_for_auth());

CREATE POLICY "Users can update own progress" ON public.academia_progresso
  FOR UPDATE USING (corretor_id = public.get_profile_id_for_auth())
  WITH CHECK (corretor_id = public.get_profile_id_for_auth());

-- Fix academia_certificados RLS policies
DROP POLICY IF EXISTS "Users can insert own certificates" ON public.academia_certificados;
DROP POLICY IF EXISTS "Users can view own certificates" ON public.academia_certificados;

CREATE POLICY "Users can view own certificates" ON public.academia_certificados
  FOR SELECT USING (corretor_id = public.get_profile_id_for_auth());

CREATE POLICY "Users can insert own certificates" ON public.academia_certificados
  FOR INSERT WITH CHECK (corretor_id = public.get_profile_id_for_auth());
