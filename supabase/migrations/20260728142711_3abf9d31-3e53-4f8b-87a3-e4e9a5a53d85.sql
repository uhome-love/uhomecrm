
ALTER TABLE public.meta_capi_queue DROP CONSTRAINT IF EXISTS meta_capi_queue_status_check;
ALTER TABLE public.meta_capi_queue ADD CONSTRAINT meta_capi_queue_status_check
  CHECK (status IN ('pending','processing','sent','failed','skipped'));
