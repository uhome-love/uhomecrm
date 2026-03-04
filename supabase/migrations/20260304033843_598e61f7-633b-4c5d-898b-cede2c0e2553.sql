
-- Add recovery_score column to leads
ALTER TABLE public.leads ADD COLUMN recovery_score integer DEFAULT NULL;

-- Create index for efficient sorting by score
CREATE INDEX idx_leads_recovery_score ON public.leads (recovery_score DESC NULLS LAST);

-- DB function to calculate recovery score deterministically
CREATE OR REPLACE FUNCTION public.calculate_recovery_score(
  p_telefone text,
  p_email text,
  p_interesse text,
  p_ultimo_contato date,
  p_origem text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  score integer := 0;
  days_since integer;
BEGIN
  -- +20 telefone válido
  IF p_telefone IS NOT NULL AND length(trim(p_telefone)) >= 8 THEN
    score := score + 20;
  END IF;

  -- +10 email válido
  IF p_email IS NOT NULL AND p_email LIKE '%@%' THEN
    score := score + 10;
  END IF;

  -- +20 interesse em empreendimento definido
  IF p_interesse IS NOT NULL AND length(trim(p_interesse)) > 2 THEN
    score := score + 20;
  ELSE
    -- -10 sem interesse definido
    score := score - 10;
  END IF;

  -- Time-based scoring
  IF p_ultimo_contato IS NOT NULL THEN
    days_since := (current_date - p_ultimo_contato);
    -- +15 lead de até 30 dias
    IF days_since <= 30 THEN
      score := score + 15;
    -- -15 lead acima de 90 dias
    ELSIF days_since > 90 THEN
      score := score - 15;
    END IF;
  ELSE
    score := score - 15; -- no contact date = old lead
  END IF;

  -- +10 origem Meta Ads
  IF lower(coalesce(p_origem, '')) LIKE '%meta%' OR lower(coalesce(p_origem, '')) LIKE '%facebook%' OR lower(coalesce(p_origem, '')) LIKE '%instagram%' THEN
    score := score + 10;
  -- +10 origem formulário
  ELSIF lower(coalesce(p_origem, '')) LIKE '%formul%' OR lower(coalesce(p_origem, '')) LIKE '%site%' OR lower(coalesce(p_origem, '')) LIKE '%portal%' THEN
    score := score + 10;
  END IF;

  -- Clamp to 0-100
  RETURN GREATEST(0, LEAST(100, score));
END;
$$;

-- Batch function to recalculate all scores
CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.leads
  SET recovery_score = calculate_recovery_score(telefone, email, interesse, ultimo_contato, origem);
$$;
