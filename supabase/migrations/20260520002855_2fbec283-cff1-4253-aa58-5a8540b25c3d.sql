-- =====================================================================
-- Migration: reengajamento_hardening_20260520
-- Author: Lucas via Claude (Lovable agent)
-- Date: 2026-05-20 BRT
-- Context: Templates casatua_maio (72% fail) e reativacao_opcoes_perfil_v2
--          (90% fail) -> ~10k falhas Meta em 7d. Central pausada manual.
--          FIX A: pausa travada / FIX B: blacklist / Fase 1.1: REVOKE anon.
-- Rollback: ver bloco comentado no final.
-- =====================================================================

-- FIX A
ALTER TABLE public.reengajamento_config
  ADD COLUMN IF NOT EXISTS paused_until_release boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS paused_at_brt timestamp;

-- FIX B
CREATE TABLE IF NOT EXISTS public.blocked_templates (
  template_name text PRIMARY KEY,
  reason        text NOT NULL,
  blocked_at    timestamptz NOT NULL DEFAULT now(),
  blocked_by    text
);

ALTER TABLE public.blocked_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read blocked_templates"
  ON public.blocked_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage blocked_templates"
  ON public.blocked_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- Fase 1.1 RLS
REVOKE SELECT ON public.reengajamento_dispatch_runs FROM anon;
REVOKE SELECT ON public.reengajamento_meta_disparos FROM anon;
REVOKE SELECT ON public.reengajamento_eventos        FROM anon;
REVOKE SELECT ON public.reengajamento_config         FROM anon;

-- =====================================================================
-- ROLLBACK (comentado):
-- GRANT SELECT ON public.reengajamento_dispatch_runs TO anon;
-- GRANT SELECT ON public.reengajamento_meta_disparos TO anon;
-- GRANT SELECT ON public.reengajamento_eventos        TO anon;
-- GRANT SELECT ON public.reengajamento_config         TO anon;
-- DROP POLICY IF EXISTS "admin manage blocked_templates" ON public.blocked_templates;
-- DROP POLICY IF EXISTS "auth read blocked_templates"   ON public.blocked_templates;
-- DROP TABLE IF EXISTS public.blocked_templates;
-- ALTER TABLE public.reengajamento_config
--   DROP COLUMN IF EXISTS paused_at_brt,
--   DROP COLUMN IF EXISTS paused_reason,
--   DROP COLUMN IF EXISTS paused_until_release;
-- =====================================================================