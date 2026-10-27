# Lead Marie Hellen escondido do Pipeline (falsamente "estagnado")

## O que aconteceu (confirmado)
- A Marie é uma cliente antiga. Ela chegou em março, foi descartada em julho e hoje (27/10) voltou pelo Golden Lake. A Rafaela aceitou o lead às 09:34 e registrou "Ligou" às 09:38. No banco ela está ativa, com a Rafaela, em Sem Contato.
- O Pipeline esconde de todo mundo (corretor, gerente e CEO) os leads "estagnados". Eles ficam só na página de Leads estagnados.
- Para saber se um lead está estagnado, o sistema compara o último contato com a data em que o lead foi entregue ao corretor. Só que a Marie voltou com a data de entrega antiga (15/03), e não com a de hoje. O último contato registrado também é antigo (22/05), porque o "Ligou" de hoje não atualizou essa data.
- Resultado: o sistema contou mais de 150 dias sem contato e considerou a Marie estagnada no mesmo minuto em que ela voltou. Por isso ela some do board.
- Existem cerca de **28 leads ativos** aceitos nos últimos 30 dias com esse mesmo risco. Pelo menos 8 deles voltaram por "novo interesse" este mês.

## Correção
1. **Regra da cor e da estagnação:** o relógio passa a contar a partir da data mais recente entre a entrega ao corretor e o aceite. Assim, um lead que volta e é aceito hoje começa verde, e não estagnado. Vale para a tela e para o banco, que usam a mesma régua.
2. **Volta por novo interesse ou reativação:** a data de entrega passa a ser a data da volta, não a do primeiro ciclo.
3. **"Ligou" e as outras ações rápidas:** confirmar se essas ações contam como contato. Se não contarem, passam a atualizar a data do último contato, como já fazem as atividades registradas.
4. **Correção dos leads atuais:** ajustar a data de entrega dos leads ativos que voltaram com a data antiga, incluindo a Marie, usando a data do aceite atual. Nada muda no corretor, na etapa ou na distribuição.

## Detalhes técnicos
- `src/lib/leadSaude.ts` `relogioBase`: ref = max(distribuido_em, aceito_em), fallback created_at. Espelhar em `public.lead_saude_status` (e nas RPCs que usam `COALESCE(distribuido_em, created_at)`, como `get_pipeline_estagnacao` e as listas de estagnados e bolsão) com uma migration fora do horário comercial.
- Os pontos que fazem a reentrada (novo interesse/reativação, `reactivateLead`, edge de entrada de leads) gravam `distribuido_em = now()` quando o lead volta para Novo Lead.
- Revisar o caminho de "Ações: Ligou" (próxima ação). Se ele não grava em `ultimo_toque_at`, passar a gravar.
- Backfill: `distribuido_em = aceito_em` onde `aceito_em > distribuido_em` e o lead está ativo.
- Teste em `leadSaude`: lead com toque antigo, entrega antiga e aceite hoje precisa dar "verde".

## Validação
- No preview, na visão CEO: buscar "Marie" e conferir que ela aparece em Sem Contato, verde, com a Rafaela.
- Conferir que a contagem de estagnados não ganhou nem perdeu leads de forma estranha.
- Simular com um lead de teste a volta por novo interesse e confirmar que ele aparece no board.
