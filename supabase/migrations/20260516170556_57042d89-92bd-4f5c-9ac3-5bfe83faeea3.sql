-- Phase 2b minimal: lock down legacy `leads_legado` table.
-- No application code references this table (front-end uses pipeline_leads).
-- RLS is already enabled+forced with user_id-scoped policies, but we additionally
-- revoke all grants from anon/authenticated so the table is fully invisible to the API.
-- Rollback: GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads_legado TO authenticated;

REVOKE ALL ON public.leads_legado FROM anon;
REVOKE ALL ON public.leads_legado FROM authenticated;

-- Drop now-redundant per-user policies (table is no longer reachable via PostgREST).
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads_legado;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.leads_legado;
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads_legado;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads_legado;

-- Single deny-all guard policy (defense in depth).
CREATE POLICY "leads_legado_denied" ON public.leads_legado
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);