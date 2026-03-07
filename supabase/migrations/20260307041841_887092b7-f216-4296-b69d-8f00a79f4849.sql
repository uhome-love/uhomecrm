
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL, -- leads, visitas, propostas, vendas, alertas
  categoria text NOT NULL, -- novo_lead, lead_sem_atendimento, venda_assinada, etc.
  titulo text NOT NULL,
  mensagem text NOT NULL,
  dados jsonb DEFAULT '{}'::jsonb,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  agrupamento_key text, -- for anti-spam grouping
  agrupamento_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Index for fast queries
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, lida, created_at DESC);
CREATE INDEX idx_notifications_agrupamento ON public.notifications (user_id, agrupamento_key) WHERE agrupamento_key IS NOT NULL;

-- Notification preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  popup_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  dashboard_alerts_enabled boolean NOT NULL DEFAULT true,
  categorias_silenciadas text[] NOT NULL DEFAULT '{}',
  horario_silencio_inicio time,
  horario_silencio_fim time,
  agrupar_similares boolean NOT NULL DEFAULT true,
  intervalo_minimo_minutos integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RPC to create notification with anti-spam
CREATE OR REPLACE FUNCTION public.criar_notificacao(
  p_user_id uuid,
  p_tipo text,
  p_categoria text,
  p_titulo text,
  p_mensagem text,
  p_dados jsonb DEFAULT '{}'::jsonb,
  p_agrupamento_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefs notification_preferences%ROWTYPE;
  v_existing_id uuid;
  v_new_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Get user preferences
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  
  -- Check if category is silenced
  IF v_prefs IS NOT NULL AND p_categoria = ANY(v_prefs.categorias_silenciadas) THEN
    RETURN NULL;
  END IF;
  
  -- Check quiet hours
  IF v_prefs IS NOT NULL 
    AND v_prefs.horario_silencio_inicio IS NOT NULL 
    AND v_prefs.horario_silencio_fim IS NOT NULL THEN
    IF (v_now AT TIME ZONE 'America/Sao_Paulo')::time 
       BETWEEN v_prefs.horario_silencio_inicio AND v_prefs.horario_silencio_fim THEN
      RETURN NULL;
    END IF;
  END IF;
  
  -- Anti-spam: check for similar recent notification
  IF p_agrupamento_key IS NOT NULL AND (v_prefs IS NULL OR v_prefs.agrupar_similares) THEN
    SELECT id INTO v_existing_id
    FROM notifications
    WHERE user_id = p_user_id
      AND agrupamento_key = p_agrupamento_key
      AND lida = false
      AND created_at > v_now - interval '30 minutes'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      UPDATE notifications
      SET agrupamento_count = agrupamento_count + 1,
          mensagem = p_mensagem,
          dados = p_dados,
          created_at = v_now
      WHERE id = v_existing_id;
      RETURN v_existing_id;
    END IF;
  END IF;
  
  -- Check minimum interval
  IF v_prefs IS NOT NULL AND v_prefs.intervalo_minimo_minutos > 0 THEN
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = p_user_id
        AND categoria = p_categoria
        AND created_at > v_now - (v_prefs.intervalo_minimo_minutos || ' minutes')::interval
    ) THEN
      RETURN NULL;
    END IF;
  END IF;
  
  -- Insert notification
  INSERT INTO notifications (user_id, tipo, categoria, titulo, mensagem, dados, agrupamento_key)
  VALUES (p_user_id, p_tipo, p_categoria, p_titulo, p_mensagem, p_dados, p_agrupamento_key)
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- RPC to mark all as read
CREATE OR REPLACE FUNCTION public.marcar_todas_notificacoes_lidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE notifications
  SET lida = true, lida_em = now()
  WHERE user_id = auth.uid() AND lida = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
