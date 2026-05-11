
-- Adiciona colunas de canal/Meta/anti-ban à config
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS meta_template_language text NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS mensagens_variantes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS pausa_longa_a_cada integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS pausa_longa_min_seconds integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS pausa_longa_max_seconds integer NOT NULL DEFAULT 480,
  ADD COLUMN IF NOT EXISTS validar_numero boolean NOT NULL DEFAULT true;

-- Trigger validation: canal precisa ser 'evolution' ou 'meta'
CREATE OR REPLACE FUNCTION public.validate_reengajamento_canal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.canal NOT IN ('evolution', 'meta') THEN
    RAISE EXCEPTION 'canal deve ser evolution ou meta';
  END IF;
  IF NEW.canal = 'meta' AND (NEW.meta_template_name IS NULL OR NEW.meta_template_name = '') THEN
    RAISE EXCEPTION 'meta_template_name obrigatório quando canal=meta';
  END IF;
  IF NEW.delay_min_seconds < 2 THEN NEW.delay_min_seconds := 2; END IF;
  IF NEW.delay_max_seconds < NEW.delay_min_seconds THEN NEW.delay_max_seconds := NEW.delay_min_seconds; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reengajamento_canal ON public.reengajamento_config;
CREATE TRIGGER trg_validate_reengajamento_canal
  BEFORE INSERT OR UPDATE ON public.reengajamento_config
  FOR EACH ROW EXECUTE FUNCTION public.validate_reengajamento_canal();

-- Defaults seguros: aumentar delays e popular variantes
UPDATE public.reengajamento_config SET
  delay_min_seconds = GREATEST(delay_min_seconds, 60),
  delay_max_seconds = GREATEST(delay_max_seconds, 180),
  mensagens_variantes = CASE WHEN array_length(mensagens_variantes,1) IS NULL THEN ARRAY[
    'Olá {nome}! 👋 Aqui é da UHome. Você buscou imóveis com a gente recentemente. Ainda está procurando? Temos novidades. Responde *SIM* se quiser ver 🏡',
    'Oi {nome}, tudo bem? 😊 Sou da equipe UHome. Vi que você se interessou por imóveis há pouco. Quer que eu te envie opções novas que combinam com seu perfil? Manda *SIM* aqui mesmo.',
    'E aí {nome}! Aqui é da UHome 🙂 Notei seu interesse em imóveis recentemente. Posso te mandar algumas opções que apareceram agora? Se sim, responde *SIM*.',
    'Oi {nome}! Lia aqui da UHome 👋 Você procurou imóveis com a gente nos últimos dias. Ainda está na busca? Temos algumas novidades. Bora dar uma olhada? Manda *SIM* 🏠',
    'Olá {nome}, sou a Lia da UHome 😊 Vi que você buscou imóveis recentemente. Quer que eu envie opções atualizadas? Se sim, responde *SIM* por aqui.'
  ] ELSE mensagens_variantes END
WHERE TRUE;

-- Tabela de disparos Meta (rastreia ciclo completo via wamid)
CREATE TABLE IF NOT EXISTS public.reengajamento_meta_disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  run_id uuid REFERENCES public.reengajamento_dispatch_runs(id) ON DELETE SET NULL,
  wamid text UNIQUE,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'pt_BR',
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'queued', -- queued|sent|delivered|read|responded|failed
  button_response text, -- 'sim' | 'nao' | NULL
  response_text text,
  error_text text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_disparos_lead ON public.reengajamento_meta_disparos(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_disparos_status ON public.reengajamento_meta_disparos(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_disparos_run ON public.reengajamento_meta_disparos(run_id);
CREATE INDEX IF NOT EXISTS idx_meta_disparos_wamid ON public.reengajamento_meta_disparos(wamid);

ALTER TABLE public.reengajamento_meta_disparos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read meta disparos" ON public.reengajamento_meta_disparos
  FOR SELECT TO authenticated USING (true);
