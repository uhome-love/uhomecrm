-- Reorganização final do Pipeline Único: renomear e reordenar etapas ativas
-- Nenhum lead é deletado; apenas nomes, ordem e cores são ajustados.

UPDATE public.pipeline_stages SET nome = 'Qualificação', ordem = 2, cor = '#6366f1'
  WHERE tipo = 'qualificacao' AND pipeline_tipo = 'leads';

UPDATE public.pipeline_stages SET nome = 'Aquecimento', ordem = 3, cor = '#f97316'
  WHERE tipo = 'aquecimento' AND pipeline_tipo = 'leads';

UPDATE public.pipeline_stages SET nome = 'Visita', ordem = 4, cor = '#10b981'
  WHERE tipo = 'visita' AND pipeline_tipo = 'leads';

UPDATE public.pipeline_stages SET nome = 'Em Negociação', ordem = 5, cor = '#ec4899'
  WHERE tipo = 'proposta' AND pipeline_tipo = 'leads';

UPDATE public.pipeline_stages SET nome = 'Contrato', ordem = 6, cor = '#06b6d4'
  WHERE tipo = 'contrato_gerado' AND pipeline_tipo = 'leads';

UPDATE public.pipeline_stages SET nome = 'Ganho', ordem = 7, cor = '#22c55e'
  WHERE tipo = 'venda' AND pipeline_tipo = 'leads';

-- Etapas legadas/consolidadas empurradas para o fim (ficam ocultas do board via código)
UPDATE public.pipeline_stages SET ordem = 20
  WHERE pipeline_tipo = 'leads'
    AND tipo IN ('contato_inicial','busca','possibilidade_visita','visita_marcada','visita_realizada','pos_visita','convertido','documentacao','negociacao','boas_vindas','envio_oportunidades','atualizacao_bem_estar','indicacoes');
