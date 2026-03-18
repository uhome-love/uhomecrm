-- Fix existing leads with raw form ID as empreendimento/formulario
UPDATE pipeline_leads 
SET 
  empreendimento = 'Seen Três Figueiras',
  formulario = 'Seen Três Figueiras (Imagem)'
WHERE formulario = '960687922961852';

-- Also fix any pipeline_atividades that show the raw number
UPDATE pipeline_atividades 
SET 
  titulo = REPLACE(titulo, '960687922961852', 'Seen Três Figueiras (Imagem)'),
  descricao = REPLACE(descricao, '960687922961852', 'Seen Três Figueiras (Imagem)')
WHERE titulo LIKE '%960687922961852%' OR descricao LIKE '%960687922961852%';