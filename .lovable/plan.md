# Lake Baikal exclusivo: Lucas (CEO) e Gabrielle (Diretora)

## O que muda para o usuário
- Todo lead novo do Lake Baikal que chega por anúncio ou site vai direto para o Lucas ou a Gabrielle, **alternando 1 para cada**. Não passa pela Roleta e não precisa de credenciamento.
- Cada um recebe o lead no **próprio pipeline**, com o aviso de lead novo no sino e no celular, igual a um corretor. O lead segue as mesmas etapas e tarefas.
- O Lake Baikal **sai do foco dos corretores**: some da tela de Foco/alocação, da lista de produtos da Roleta e dos corretores credenciados no segmento Alto Padrão (S3), só para esse empreendimento. Os outros produtos do S3 continuam iguais.
- **Os 27 clientes atuais** do Lake Baikal continuam com os corretores que já atendem.
- **Cadastro manual ou indicação** de um corretor com Lake Baikal continua permitido.
- Lucas e Gabrielle passam a ver o "Modo Corretor" (Pipeline e tarefas próprias) no menu, sem perder a visão de CEO/diretora.

## Fases (uma de cada vez, validando antes da próxima)
1. **Mockup** do menu e do pipeline próprio do Lucas/Gabrielle e do aviso de lead novo — aprovação antes de mexer.
2. **Regra de distribuição:** configuração "produto exclusivo" ligando Lake Baikal aos dois, com revezamento. A distribuição olha essa regra antes da Roleta. Se der erro, o lead cai na Fila CEO (nunca se perde).
3. **Tirar do foco dos corretores:** Lake Baikal sai do segmento S3 da Roleta e das telas de Foco/Match.
4. **Pipeline próprio:** liberar o Modo Corretor para os dois.
5. **Teste com lead de teste** (formulário do Lake Baikal): confirmar que alterna Lucas → Gabrielle → Lucas, que chega no pipeline e no sino, e que nenhum corretor recebe. Depois apagar o lead de teste.

## Detalhes técnicos
- Lake Baikal: canônico `8654bd9d-6d44-43dc-b741-97a86fec8c9d`; hoje em `roleta_campanhas` no segmento "S3 - Alto Padrão". Últimos 30 dias: 0 leads novos.
- Lucas Sarmento (admin) `0de4a362-...`; Gabrielle Rodrigues (gerente/diretora) `7882d73e-...`.
- Nova tabela `empreendimento_exclusividade` (empreendimento_canonico_id, user_ids[], ultimo_idx, ativo) com GRANT + RLS (leitura autenticada, escrita só admin). Chave independente, sem afetar `crm_gate_ativo`/`visitas_gate_ativo`.
- `distribuir_lead_atomico`: passo inicial — se o canônico do lead tiver exclusividade ativa e origem não for manual, atribui ao próximo do revezamento (lock na linha para evitar corrida), grava `distribuicao_historico` e dispara a mesma notificação de lead novo. Pula SLA de aceite da Roleta.
- Remover Lake Baikal de `roleta_campanhas` (S3) e esconder nas telas de Foco/alocação lendo a tabela de exclusividade.
- Sem mexer nos leads existentes; sem alterar CAPI. 1 migração, aplicada fora do horário de expediente.
