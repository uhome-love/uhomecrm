CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  route text NOT NULL,
  route_pattern text NOT NULL,
  referrer_route text NULL,
  session_id text NOT NULL,
  duration_ms integer NULL,
  viewport_width integer NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_viewed_at ON public.page_views (viewed_at DESC);
CREATE INDEX idx_page_views_user_viewed ON public.page_views (user_id, viewed_at DESC);
CREATE INDEX idx_page_views_pattern_viewed ON public.page_views (route_pattern, viewed_at DESC);
CREATE INDEX idx_page_views_role_viewed ON public.page_views (role, viewed_at DESC);
CREATE INDEX idx_page_views_session ON public.page_views (session_id, viewed_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own page_views"
  ON public.page_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins read all page_views"
  ON public.page_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "authenticated insert own page_views"
  ON public.page_views FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated update own duration"
  ON public.page_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());