UPDATE public.materiais_links SET categoria = 'apresentacao_book' WHERE categoria IN ('book','apresentacao');
UPDATE public.materiais_links SET categoria = 'tabela' WHERE categoria = 'tabela_vendas';
UPDATE public.materiais_links SET categoria = 'script_atendimento' WHERE categoria = 'material_atendimento';
UPDATE public.materiais_links SET categoria = 'imagens' WHERE categoria = 'fotos';
UPDATE public.materiais_links SET categoria = 'outros' WHERE categoria = 'plantas';