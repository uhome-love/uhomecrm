DELETE FROM public.meta_capi_queue WHERE lead_id IN (SELECT id FROM public.pipeline_leads WHERE nome ILIKE 'Lucas Sarmento');
DELETE FROM public.pipeline_leads WHERE nome ILIKE 'Lucas Sarmento';