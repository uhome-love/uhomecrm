
-- Fix names that couldn't be properly extracted from email usernames
UPDATE pipeline_leads SET nome = 'Daniel P.H.' WHERE id = 'e19b90cb-0fcc-4bbd-bf42-99ff6f586fc2';
UPDATE pipeline_leads SET nome = 'J.B.R. Almeida' WHERE id = '2d71d375-85c8-4c89-ae18-ea348167bf78';
UPDATE pipeline_leads SET nome = 'Patrícia M.' WHERE id = '7ceb0ef4-7299-49a7-b51f-f7dd3f752a4e';
UPDATE pipeline_leads SET nome = 'R. Luna' WHERE id = '1923beb9-b09e-4839-b311-c628de2d91df';
UPDATE pipeline_leads SET nome = 'Rodrigo da Silva Borges' WHERE id = '15b683d6-d7a2-48ee-8613-5a2cc359087e';
UPDATE pipeline_leads SET nome = 'Renato C.' WHERE id = '6cefbc0b-f694-4403-bc56-0b0f5a4ef641';
UPDATE pipeline_leads SET nome = 'Rafael L. Santos' WHERE id = 'bbff607f-023c-4c46-8f8b-e1e2ec574656';
UPDATE pipeline_leads SET nome = 'Lucas Ribeiro' WHERE id = '455dc55a-06de-4167-b33f-4fd72754053a';
-- Fix telefone_normalizado for Bruno (had country code)
UPDATE pipeline_leads SET telefone_normalizado = '34999860760' WHERE id = '647db7a4-29fe-48cf-bb1f-0f10753f5524' AND telefone_normalizado = '5534999860760';
