
-- Enable force RLS on critical tables to prevent bypass
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.oferta_ativa_leads FORCE ROW LEVEL SECURITY;

-- Also force RLS on other sensitive tables
ALTER TABLE public.oferta_ativa_tentativas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
