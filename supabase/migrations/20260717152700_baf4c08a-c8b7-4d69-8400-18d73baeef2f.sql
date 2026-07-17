
-- Limpeza de débito técnico Fase 2 (item 1): DROPs sem dependência bloqueante.
DROP TABLE IF EXISTS public.imoveis_catalog_sync_status CASCADE;
DROP TABLE IF EXISTS public.imoveis_catalog CASCADE;
DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.campanha_atrio_eventos CASCADE;
DROP TABLE IF EXISTS public.campanha_atrio_respostas CASCADE;
DROP TABLE IF EXISTS public.campanha_atrio_controle CASCADE;
DROP TABLE IF EXISTS public.campanha_atrio_audiencia CASCADE;
DROP TABLE IF EXISTS public.campanha_atrio_supressao CASCADE;
DROP TABLE IF EXISTS public.audit_log_atrio_22_05_2026 CASCADE;
DROP TABLE IF EXISTS public.manager_checklist CASCADE;
