
-- Add concurrency lock columns to oferta_ativa_leads
ALTER TABLE public.oferta_ativa_leads 
ADD COLUMN em_atendimento_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN em_atendimento_ate timestamp with time zone;
