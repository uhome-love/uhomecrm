
-- Habilitar extensão moddatetime
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- 1. whatsapp_instancias
CREATE TABLE public.whatsapp_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aguardando_qr',
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor sees own instance"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Gestor sees team instances"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = whatsapp_instancias.corretor_id)
        AND gerente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'ativo'
    )
  );

CREATE POLICY "Admin sees all instances"
  ON public.whatsapp_instancias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Corretor manages own instance"
  ON public.whatsapp_instancias FOR ALL TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admin manages all instances"
  ON public.whatsapp_instancias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.whatsapp_instancias
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE INDEX idx_whatsapp_instancias_corretor ON public.whatsapp_instancias(corretor_id);

-- 2. whatsapp_mensagens
CREATE TABLE public.whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.pipeline_leads(id) ON DELETE CASCADE,
  corretor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('sent', 'received')),
  body text NOT NULL DEFAULT '',
  media_url text,
  whatsapp_message_id text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Corretor sees own messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Gestor sees team messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE user_id = (SELECT user_id FROM profiles WHERE id = whatsapp_mensagens.corretor_id)
        AND gerente_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'ativo'
    )
  );

CREATE POLICY "Admin sees all messages"
  ON public.whatsapp_mensagens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Corretor inserts own messages"
  ON public.whatsapp_mensagens FOR INSERT TO authenticated
  WITH CHECK (corretor_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admin inserts any message"
  ON public.whatsapp_mensagens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_whatsapp_mensagens_lead ON public.whatsapp_mensagens(lead_id);
CREATE INDEX idx_whatsapp_mensagens_corretor ON public.whatsapp_mensagens(corretor_id);
CREATE INDEX idx_whatsapp_mensagens_timestamp ON public.whatsapp_mensagens("timestamp" DESC);
