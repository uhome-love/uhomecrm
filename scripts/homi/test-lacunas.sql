-- Read-only concrete tests for qualification gaps and proven pending work; no client changes.
WITH tests(name,input,expected) AS (VALUES
 ('objetivo nulo','{"qualificacao":{"status":"ok","dados":{"objetivo_cliente":null,"faixa_valor":"500 mil","prazo_decisao":"30 dias","forma_pagamento":"PIX"}}}'::jsonb,'["objetivo_cliente: não informado"]'::jsonb),
 ('faixa nula','{"qualificacao":{"status":"ok","dados":{"objetivo_cliente":"morar","faixa_valor":null,"prazo_decisao":"30 dias","forma_pagamento":"PIX"}}}'::jsonb,'["faixa_valor: não informado"]'::jsonb),
 ('prazo nulo','{"qualificacao":{"status":"ok","dados":{"objetivo_cliente":"morar","faixa_valor":"500 mil","prazo_decisao":null,"forma_pagamento":"PIX"}}}'::jsonb,'["prazo_decisao: não informado"]'::jsonb),
 ('pagamento nulo','{"qualificacao":{"status":"ok","dados":{"objetivo_cliente":"morar","faixa_valor":"500 mil","prazo_decisao":"30 dias","forma_pagamento":null}}}'::jsonb,'["forma_pagamento: não informado"]'::jsonb),
 ('sem tarefa','{"tarefas":{"status":"vazio","dados":null}}'::jsonb,'["sem tarefa futura"]'::jsonb),
 ('visita pendente','{"visitas":{"status":"ok","dados":[{"id":"teste","ciclo":"atual","data_visita":"2020-01-01","status":"realizada","resultado_visita":null}]}}'::jsonb,'["visita sem resultado: teste"]'::jsonb),
 ('contato pendente','{"timeline":{"status":"ok","dados":{"fatos":[{"data":"2026-11-05","ciclo":"atual","tipo":"ligacao","resultado":null}]}}}'::jsonb,'["contato sem resultado registrado"]'::jsonb),
 ('fontes indisponiveis','{"qualificacao":{"status":"indisponível","dados":null},"tarefas":{"status":"indisponível","dados":null},"visitas":{"status":"indisponível","dados":null}}'::jsonb,'[]'::jsonb)
)
SELECT name,public.homi_lacunas(input)=expected AS passed FROM tests;