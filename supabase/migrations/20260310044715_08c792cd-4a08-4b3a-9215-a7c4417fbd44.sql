
-- Remove duplicate "Sem Contato" (the orange one) and "Atendimento" stages with no leads
DELETE FROM pipeline_stages WHERE id = '4e2996b2-5e5e-4fd4-ab37-06f4c222a4ed';
DELETE FROM pipeline_stages WHERE id = 'a3bbdcf3-63ed-4a92-b383-6e2b94ad452d';

-- Fix ordering: Novo Lead=0, Sem Contato=1, Contato Iniciado=2, Qualificação=3, Possível Visita=4, Visita Marcada=5, Visita Realizada=6, Descarte=7
UPDATE pipeline_stages SET ordem = 0 WHERE id = 'd3843b2f-2fa1-4c31-9129-4eb0ed21f019'; -- Novo Lead
UPDATE pipeline_stages SET ordem = 1 WHERE id = '2fcba9be-1188-4a54-9452-394beefdc330'; -- Sem Contato
UPDATE pipeline_stages SET ordem = 2 WHERE id = '8e2a3285-70f9-438d-be2d-13b0bf4610c4'; -- Contato Iniciado
UPDATE pipeline_stages SET ordem = 3 WHERE id = '1ea43190-44c8-43ec-91b4-409b055b0e58'; -- Qualificação
UPDATE pipeline_stages SET ordem = 4 WHERE id = '2096921e-f8c9-4212-91c8-dae055bc5710'; -- Possível Visita
UPDATE pipeline_stages SET ordem = 5 WHERE id = 'c9fcf0ad-dcab-4575-b91f-3f76610e4d44'; -- Visita Marcada
UPDATE pipeline_stages SET ordem = 6 WHERE id = '5ad4f4aa-b66f-4dc2-ac90-97c55e846a14'; -- Visita Realizada
UPDATE pipeline_stages SET ordem = 7 WHERE id = '1dd66c25-3848-4053-9f66-82e902989b4d'; -- Descarte
