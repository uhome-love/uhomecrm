
ALTER TABLE public.whatsapp_mensagens 
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS quoted_message_id text,
  ADD COLUMN IF NOT EXISTS media_type text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_delivery_status 
  ON public.whatsapp_mensagens(delivery_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_whatsapp_message_id 
  ON public.whatsapp_mensagens(whatsapp_message_id);
