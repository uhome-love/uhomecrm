-- Bug 4: Allow corretores to INSERT their own leads into pipeline_leads
CREATE POLICY "Corretores can insert own pipeline leads"
ON public.pipeline_leads
FOR INSERT
TO authenticated
WITH CHECK (
  corretor_id = auth.uid()
  AND created_by = auth.uid()
);

-- Bug 5: Allow all authenticated users to read profiles (needed for partnerships, rankings, etc.)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Bug 5: Allow all authenticated users to read team_members (needed for partnerships)
CREATE POLICY "Authenticated can view all team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive policies that are now superseded
DROP POLICY IF EXISTS "Corretores can view own team membership" ON public.team_members;
DROP POLICY IF EXISTS "Gerentes can view own team" ON public.team_members;