
-- Fix security definer views: set to security_invoker so RLS of the querying user applies
ALTER VIEW public.v_kpi_ligacoes SET (security_invoker = true);
ALTER VIEW public.v_kpi_visitas SET (security_invoker = true);
ALTER VIEW public.v_kpi_negocios SET (security_invoker = true);
ALTER VIEW public.v_kpi_gestao_leads SET (security_invoker = true);
ALTER VIEW public.v_kpi_presenca SET (security_invoker = true);
ALTER VIEW public.v_kpi_disponibilidade SET (security_invoker = true);
