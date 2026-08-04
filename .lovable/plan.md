# Regra fixa: sem corretor alocado e ativo no produto → Fila do CEO

## Problema atual

Hoje, quando um lead chega com empreendimento identificado, a distribuição tenta primeiro o pool de corretores **alocados naquele empreendimento** e que estão ativos na roleta. Se esse pool está vazio, ela **não** para: cai automaticamente num segundo pool por **segmento**, e o lead vai para qualquer corretor credenciado do segmento — mesmo sem foco no produto.

## Regra nova

Se o lead tem empreendimento identificado e **não existe nenhum corretor alocado nesse empreendimento ativo na roleta naquele momento**, o lead vai direto para a **Fila do CEO** (`pendente_distribuicao`), com o motivo "sem corretor alocado ativo neste produto". Nada de repassar para corretor sem foco.

Continua igual:
- Lead com corretor alocado e ativo → distribui normalmente (rodízio por produto).
- Lead **sem** empreendimento identificado → mantém o comportamento atual (pool por segmento), já que não há produto para checar.
- Empreendimento inativo → Fila do CEO (já existia).
- Despacho manual da Fila do CEO pelo CEO/gestor → inalterado.

## Onde o CEO vê

Na Fila do CEO o motivo aparece como "sem corretor alocado ativo neste produto" — o rótulo já existe na tela, então nenhuma mudança de frontend é necessária.

## Detalhes técnicos

- Uma migration com `CREATE OR REPLACE FUNCTION public.distribuir_lead_atomico(...)`, mesma assinatura e mesmo corpo, com uma única alteração de fluxo:
  - No ramo em que `v_emp_canonico_id IS NOT NULL` e o pool "alocado" não retorna ninguém, em vez de setar `v_use_segmento := TRUE`, define `v_failure_reason := 'sem_alocado_produto'` e segue para o bloco de Fila do CEO já existente (`aceite_status='pendente_distribuicao'`, `motivo_pendencia`, registro em `distribuicao_historico` com `pool='fila_ceo'`).
  - O fallback por segmento passa a valer somente quando `v_emp_canonico_id IS NULL`.
- Sem mudanças em `credenciar_por_alocacao`, roleta, edge functions ou frontend.
- Validação após aplicar: conferir na Fila do CEO que leads de produto sem corretor alocado passam a entrar com o motivo novo, e que leads de produto com corretor alocado continuam sendo distribuídos normalmente.
