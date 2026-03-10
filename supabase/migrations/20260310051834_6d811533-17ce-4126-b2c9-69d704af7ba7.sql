
-- Create Convertido stage (order 9, after Descarte which is 8)
INSERT INTO public.pipeline_stages (nome, tipo, cor, ordem, pipeline_tipo, ativo)
VALUES ('Convertido', 'convertido', '#8B5CF6', 9, 'leads', true)
ON CONFLICT DO NOTHING;
