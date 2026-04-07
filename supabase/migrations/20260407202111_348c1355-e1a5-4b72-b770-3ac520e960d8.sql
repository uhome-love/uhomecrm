
-- 1. Insert new stage "Em Evolução" with ordem 7
INSERT INTO pipeline_stages (id, nome, tipo, cor, ordem, pipeline_tipo)
VALUES (gen_random_uuid(), 'Em Evolução', 'em_evolucao', '#06B6D4', 7, 'leads');

-- 2. Reorder Descarte to ordem 8
UPDATE pipeline_stages SET ordem = 8 WHERE id = '1dd66c25-3848-4053-9f66-82e902989b4d';

-- 3. Rename "Convertido" to "Negócio Criado" and set ordem 9
UPDATE pipeline_stages SET nome = 'Negócio Criado', ordem = 9 WHERE id = 'a8a1a867-5b0c-414e-9532-8873c4ca5a0f';
