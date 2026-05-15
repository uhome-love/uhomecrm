CREATE TABLE IF NOT EXISTS public.visita_amanha_disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  wamid text,
  phone text,
  status text NOT NULL DEFAULT 'sent',
  resposta_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visita_amanha_disparos_lead_unique UNIQUE (pipeline_lead_id)
);
CREATE INDEX IF NOT EXISTS idx_vad_status ON public.visita_amanha_disparos(status);
CREATE INDEX IF NOT EXISTS idx_vad_sent_at ON public.visita_amanha_disparos(sent_at DESC);

ALTER TABLE public.visita_amanha_disparos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor/Admin leem disparos visita amanha"
ON public.visita_amanha_disparos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Service role gerencia disparos visita amanha"
ON public.visita_amanha_disparos FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.visita_amanha_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT true,
  meta_template_name text NOT NULL DEFAULT 'visita_amanha_v1',
  meta_template_language text NOT NULL DEFAULT 'pt_BR',
  daily_limit int NOT NULL DEFAULT 500,
  delay_min_seconds int NOT NULL DEFAULT 60,
  delay_max_seconds int NOT NULL DEFAULT 180,
  pausa_longa_a_cada int NOT NULL DEFAULT 6,
  pausa_longa_min_seconds int NOT NULL DEFAULT 180,
  pausa_longa_max_seconds int NOT NULL DEFAULT 480,
  horario_inicio time NOT NULL DEFAULT '09:00',
  horario_fim time NOT NULL DEFAULT '20:00',
  stages_alvo text[] NOT NULL DEFAULT ARRAY['Sem Contato','Contato Iniciado','Busca','Aquecimento'],
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.visita_amanha_config (enabled, paused)
SELECT true, true
WHERE NOT EXISTS (SELECT 1 FROM public.visita_amanha_config);

ALTER TABLE public.visita_amanha_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor/Admin leem config visita amanha"
ON public.visita_amanha_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Gestor/Admin atualizam config visita amanha"
ON public.visita_amanha_config FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Service role gerencia config visita amanha"
ON public.visita_amanha_config FOR ALL TO service_role
USING (true) WITH CHECK (true);

ALTER TABLE public.pipeline_leads
  ADD COLUMN IF NOT EXISTS visita_amanha_resposta text;