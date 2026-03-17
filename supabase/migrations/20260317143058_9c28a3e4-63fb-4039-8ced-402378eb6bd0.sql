ALTER TABLE public.ai_calls ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id text;
CREATE INDEX IF NOT EXISTS idx_ai_calls_elevenlabs_conv_id ON public.ai_calls(elevenlabs_conversation_id) WHERE elevenlabs_conversation_id IS NOT NULL;
UPDATE public.ai_calls SET elevenlabs_conversation_id = twilio_call_sid WHERE twilio_call_sid LIKE 'conv_%' AND elevenlabs_conversation_id IS NULL;