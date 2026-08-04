-- ═══ Build A — snapshots de rollback ═══
CREATE TABLE IF NOT EXISTS public._rollback_b1final (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objeto text NOT NULL,
  tipo text NOT NULL,
  definicao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._rollback_b1final ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._rollback_b1final TO service_role;

INSERT INTO public._rollback_b1final (objeto, tipo, definicao)
SELECT p.oid::regprocedure::text, 'proacl', coalesce(array_to_string(p.proacl, ','), '(default)')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'finalizar_tentativa_v2','fetch_next_lead','fetch_next_lead_campaign',
  'oferta_ativa_lock_next_lead','skip_oa_lead','aceitar_lead','rejeitar_lead',
  'lock_lead_atomic','renew_lead_lock');

INSERT INTO public._rollback_b1final (objeto, tipo, definicao)
SELECT p.oid::regprocedure::text, 'functiondef', pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'finalizar_tentativa_v2','fetch_next_lead','fetch_next_lead_campaign',
  'oferta_ativa_lock_next_lead','skip_oa_lead','aceitar_lead','rejeitar_lead',
  'lock_lead_atomic','renew_lead_lock');

-- ═══ Item 10 — REVOKE FROM PUBLIC nas 9 RPCs de ação ═══
REVOKE EXECUTE ON FUNCTION public.aceitar_lead(uuid,uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.aceitar_lead(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rejeitar_lead(uuid,uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rejeitar_lead(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fetch_next_lead(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fetch_next_lead(uuid,uuid,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fetch_next_lead_campaign(uuid,uuid[],integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fetch_next_lead_campaign(uuid,uuid[],integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.finalizar_tentativa_v2(uuid,uuid,text,text,text,uuid,text,text,boolean,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.finalizar_tentativa_v2(uuid,uuid,text,text,text,uuid,text,text,boolean,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.lock_lead_atomic(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.lock_lead_atomic(uuid,uuid,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.renew_lead_lock(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.renew_lead_lock(uuid,uuid,integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.oferta_ativa_lock_next_lead(uuid,uuid,uuid[],uuid[],boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.oferta_ativa_lock_next_lead(uuid,uuid,uuid[],uuid[],boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.skip_oa_lead(uuid,uuid,uuid,integer,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.skip_oa_lead(uuid,uuid,uuid,integer,text) TO authenticated, service_role;

-- ═══ Item 11 — status do token Meta Ads sem expor o valor ═══
CREATE OR REPLACE FUNCTION public.get_meta_ads_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_result jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'diretor'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT value INTO v_token FROM public.integration_settings WHERE key = 'meta_ads_access_token';

  SELECT jsonb_build_object(
    'configured', COALESCE(v_token, '') <> '',
    'last4', CASE WHEN COALESCE(v_token,'') = '' THEN NULL
                  WHEN v_token = 'vault:meta_ads_access_token' THEN 'vault'
                  ELSE right(v_token, 4) END,
    'in_vault', v_token = 'vault:meta_ads_access_token',
    'account_id', (SELECT value FROM public.integration_settings WHERE key = 'meta_ads_account_id'),
    'cpl_limit', (SELECT value FROM public.integration_settings WHERE key = 'meta_ads_cpl_limit'),
    'auto_sync', (SELECT value FROM public.integration_settings WHERE key = 'meta_ads_auto_sync')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_meta_ads_status() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_meta_ads_status() TO authenticated, service_role;