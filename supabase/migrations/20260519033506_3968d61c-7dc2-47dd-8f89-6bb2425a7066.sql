
DELETE FROM public.ops_events
WHERE fn = '__mock_health_test'
   OR (fn = 'edge-health-alert' AND ctx->>'function_alerted' = '__mock_health_test');

DELETE FROM public.notifications
WHERE titulo LIKE '%__mock_health_test%';
