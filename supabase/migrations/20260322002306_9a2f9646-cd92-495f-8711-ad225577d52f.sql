
-- Adicionar imovel_codigo na tabela leads (código Jetimob do imóvel, ex: '18273-BT')
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS imovel_codigo text;
CREATE INDEX IF NOT EXISTS idx_leads_imovel_codigo ON public.leads(imovel_codigo);

-- Adicionar imovel_codigo na tabela oportunidades
ALTER TABLE public.oportunidades ADD COLUMN IF NOT EXISTS imovel_codigo text;

-- Adicionar imovel_codigo na tabela imoveis_interesse (já tem imovel_id_site, mas precisa do código Jetimob)
ALTER TABLE public.imoveis_interesse ADD COLUMN IF NOT EXISTS imovel_codigo text;
CREATE INDEX IF NOT EXISTS idx_imoveis_interesse_codigo ON public.imoveis_interesse(imovel_codigo);
