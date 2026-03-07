
-- Fix the overly permissive INSERT policy
DROP POLICY "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
