-- Add new stage types to the enum
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'contrato_gerado';
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'caiu';
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'boas_vindas';
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'envio_oportunidades';
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'atualizacao_bem_estar';
ALTER TYPE public.pipeline_stage_type ADD VALUE IF NOT EXISTS 'indicacoes';