
CREATE TABLE public.ai_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  lista_ids text[] NOT NULL DEFAULT '{}',
  result_filter text DEFAULT 'all',
  delay_seconds int DEFAULT 5,
  queue_lead_ids text[] NOT NULL DEFAULT '{}',
  current_index int DEFAULT 0,
  total_leads int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sessions"
ON public.ai_call_sessions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
