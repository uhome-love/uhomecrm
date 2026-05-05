-- Create S5 - Produto Foco segment
INSERT INTO public.roleta_segmentos (id, nome, ativo)
VALUES ('5311aaaa-0000-4000-8000-000000000005', 'S5 - Produto Foco', true);

-- Move Casa Tua to S5 and disable "ignorar_segmento" (so it stops distributing to all)
UPDATE public.roleta_campanhas
SET segmento_id = '5311aaaa-0000-4000-8000-000000000005',
    ignorar_segmento = false
WHERE empreendimento ILIKE 'casa tua';