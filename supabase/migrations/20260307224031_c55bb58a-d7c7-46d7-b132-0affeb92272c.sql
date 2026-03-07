-- Add pipeline_tipo column to pipeline_stages
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_tipo text NOT NULL DEFAULT 'leads';