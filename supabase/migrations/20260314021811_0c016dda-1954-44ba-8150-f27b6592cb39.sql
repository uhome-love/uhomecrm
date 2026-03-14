
-- Fase 1: Add auth_user_id columns to tables that currently reference profiles.id
-- This is non-destructive: existing corretor_id columns are NOT modified

-- 1. negocios
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 2. checkpoint_diario
ALTER TABLE public.checkpoint_diario ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 3. academia_progresso
ALTER TABLE public.academia_progresso ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 4. academia_certificados
ALTER TABLE public.academia_certificados ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 5. lead_progressao
ALTER TABLE public.lead_progressao ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 6. roleta_credenciamentos
ALTER TABLE public.roleta_credenciamentos ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 7. empreendimento_fichas (atualizado_por references profiles.id)
ALTER TABLE public.empreendimento_fichas ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 8. corretor_reports (corretor_id references team_members.id, needs auth mapping)
ALTER TABLE public.corretor_reports ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Backfill all tables from profiles.user_id lookup
UPDATE public.negocios n SET auth_user_id = p.user_id FROM public.profiles p WHERE n.corretor_id = p.id AND n.auth_user_id IS NULL;
UPDATE public.checkpoint_diario cd SET auth_user_id = p.user_id FROM public.profiles p WHERE cd.corretor_id = p.id AND cd.auth_user_id IS NULL;
UPDATE public.academia_progresso ap SET auth_user_id = p.user_id FROM public.profiles p WHERE ap.corretor_id = p.id AND ap.auth_user_id IS NULL;
UPDATE public.academia_certificados ac SET auth_user_id = p.user_id FROM public.profiles p WHERE ac.corretor_id = p.id AND ac.auth_user_id IS NULL;
UPDATE public.lead_progressao lp SET auth_user_id = p.user_id FROM public.profiles p WHERE lp.corretor_id = p.id AND lp.auth_user_id IS NULL;
UPDATE public.roleta_credenciamentos rc SET auth_user_id = p.user_id FROM public.profiles p WHERE rc.corretor_id = p.id AND rc.auth_user_id IS NULL;
UPDATE public.empreendimento_fichas ef SET auth_user_id = p.user_id FROM public.profiles p WHERE ef.atualizado_por = p.id AND ef.auth_user_id IS NULL;

-- corretor_reports: corretor_id → team_members.id → team_members.user_id (already auth.user_id)
UPDATE public.corretor_reports cr SET auth_user_id = tm.user_id FROM public.team_members tm WHERE cr.corretor_id = tm.id AND cr.auth_user_id IS NULL;

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_negocios_auth_user_id ON public.negocios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_diario_auth_user_id ON public.checkpoint_diario(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_academia_progresso_auth_user_id ON public.academia_progresso(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_progressao_auth_user_id ON public.lead_progressao(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_roleta_credenciamentos_auth_user_id ON public.roleta_credenciamentos(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_corretor_reports_auth_user_id ON public.corretor_reports(auth_user_id);

-- Trigger: auto-populate auth_user_id on INSERT for negocios (most critical table)
CREATE OR REPLACE FUNCTION public.set_negocios_auth_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL AND NEW.corretor_id IS NOT NULL THEN
    SELECT user_id INTO NEW.auth_user_id FROM public.profiles WHERE id = NEW.corretor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_negocios_auth_user_id ON public.negocios;
CREATE TRIGGER trg_set_negocios_auth_user_id
  BEFORE INSERT OR UPDATE ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_negocios_auth_user_id();

-- Trigger: auto-populate auth_user_id on INSERT for roleta_credenciamentos
CREATE OR REPLACE FUNCTION public.set_credenciamento_auth_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auth_user_id IS NULL AND NEW.corretor_id IS NOT NULL THEN
    SELECT user_id INTO NEW.auth_user_id FROM public.profiles WHERE id = NEW.corretor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_credenciamento_auth_user_id ON public.roleta_credenciamentos;
CREATE TRIGGER trg_set_credenciamento_auth_user_id
  BEFORE INSERT OR UPDATE ON public.roleta_credenciamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_credenciamento_auth_user_id();
