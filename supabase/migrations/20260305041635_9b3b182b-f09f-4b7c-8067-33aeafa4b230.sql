
-- Table for HOMI conversation history
CREATE TABLE public.homi_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'chat', -- 'chat' or 'acao'
  acao text, -- e.g. 'responder_whatsapp', null for chat
  empreendimento text,
  situacao text,
  objetivo text,
  titulo text, -- auto-generated summary title
  mensagens jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of {role, content}
  resultado text, -- for acao type, the generated result
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homi_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
ON public.homi_conversations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
ON public.homi_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
ON public.homi_conversations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
ON public.homi_conversations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
