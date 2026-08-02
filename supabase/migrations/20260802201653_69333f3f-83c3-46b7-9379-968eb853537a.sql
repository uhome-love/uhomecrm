ALTER TABLE public.homi_conversations
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_homi_conversations_user_updated
  ON public.homi_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.homi_memoria_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  chave text NOT NULL,
  valor text NOT NULL,
  origem text NOT NULL DEFAULT 'homi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homi_memoria_usuario TO authenticated;
GRANT ALL ON public.homi_memoria_usuario TO service_role;
ALTER TABLE public.homi_memoria_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memoria_usuario_own" ON public.homi_memoria_usuario
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.homi_memoria_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  chave text NOT NULL,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homi_memoria_lead TO authenticated;
GRANT ALL ON public.homi_memoria_lead TO service_role;
ALTER TABLE public.homi_memoria_lead ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memoria_lead_own" ON public.homi_memoria_lead
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_homi_memoria_usuario_updated
  BEFORE UPDATE ON public.homi_memoria_usuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_homi_memoria_lead_updated
  BEFORE UPDATE ON public.homi_memoria_lead
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();