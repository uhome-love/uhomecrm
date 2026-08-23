-- LIA multiproduto: âncora do produto na conversa viva (lia_estado). Resolvido na
-- 1ª mensagem pelo anúncio (referral) e usado para escolher a ficha certa e o
-- destino do handoff. Aditivo, nullable, default null = comportamento de hoje (Canoas).
ALTER TABLE public.lia_estado
  ADD COLUMN IF NOT EXISTS produto_slug text;
