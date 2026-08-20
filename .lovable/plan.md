# Por que os top-ups de Cloud & AI queimam todo mês — diagnóstico e plano de redução

Foco: os top-ups da tela **Cloud & AI balance** (US$ 211,58 em Cloud + US$ 35,31 em AI), não os créditos de mensagem do editor.

## 1. Onde o dinheiro está indo (dados reais do ledger)

Últimos 30 dias (21/jul → 20/ago), só itens de Cloud + AI:

| Item | Créditos 30d | % do Cloud+AI |
|---|---|---|
| Cloud compute Large | 167,8 | 43% |
| Cloud compute XL | 163,3 | 42% |
| AI Gateway (gemini-3.6-flash in+out) | 32,2 | 8% |
| AI Gateway (gemini-2.5-flash / pro / embeddings) | 11,7 | 3% |
| Cloud egress | 8,6 | 2% |
| Cloud functions | 4,3 | 1% |
| Realtime + cached egress + storage | 3,7 | 1% |

Mês anterior (21/jun → 20/jul): compute 332 créditos, egress **43,5**, AI Gateway ~2.

Leituras diretas:
- **85% do gasto é COMPUTE do banco**, cobrado por hora de instância ligada — não por uso. Rodar Large 24/7 e escalar para XL é o custo, independentemente de ter 1 ou 100 usuários online.
- **A conta de AI multiplicou por ~20 no último mês** (de ~2 para ~44 créditos) — é a LIA/HOMI.
- Egress caiu de 43,5 para 8,6, mas volta a subir quando alguém abre telas que puxam tabela inteira.

## 2. Causa raiz do compute

O banco nunca fica ocioso. Hoje existem **7 cron jobs rodando a cada minuto** (`lead-escalation-every-minute`, `typesense-sync-cron`, `mailgun-batch-send`, `expirar-aceites-roleta`, `reengajamento-worker-tick`, `meta-capi-dispatch-5min`, `lia-poll-meta-1min`), mais `typesense-batch-reindex` a cada 2 min, 3 jobs a cada 5 min e 2 a cada 10 min.

Isso é ~15 mil execuções/dia batendo no banco, boa parte delas achando "nada para fazer". Cada tick acorda conexões, roda queries e mantém a CPU alta o suficiente para justificar Large/XL o tempo todo — inclusive de madrugada e fim de semana, quando não há operação.

Somado a isso: o frontend refaz o mesmo conjunto de queries a cada troca de tela (perfil, user_roles, notificações, disponibilidade repetem a cada navegação, várias vezes por minuto por usuário logado).

## 3. Causa raiz do AI

3.753 chamadas ao gateway em 7 dias, quase todas `gemini-3.6-flash` com **~13.000 tokens de entrada por mensagem** e 500–2.000 de saída. Ou seja: a cada turno de conversa da LIA o prompt inteiro (persona + regras + tabela de preços + histórico) é reenviado. O custo é ~95% input, não output. Multiplicado por ~500 chamadas/dia, dá a conta de AI.

## 4. Plano de redução

### Fase A — Compute (alvo: −40% a −60% do maior bucket)
1. **Auditar cada cron de 1 minuto** e reclassificar:
   - o que é realmente tempo-real (aceite de roleta, dispatch CAPI) fica;
   - o que pode ir para 5/10/15 min (typesense sync e reindex, mailgun batch, reengajamento tick, lia-poll) sobe o intervalo;
   - o que só faz sentido em horário comercial ganha janela (ex.: `7-22 * * 1-6` em vez de `* * * * *`).
2. **Saída antecipada barata**: cada worker deve começar por um `SELECT ... LIMIT 1` indexado e sair sem abrir transação quando não há fila. Hoje vários rodam varredura completa antes de descobrir que não têm trabalho.
3. **Índices** nas colunas de fila que esses jobs varrem (`status`, `vence_em`, `aceite_expira_em`, `processado_em`) — sequential scan a cada minuto é o que segura CPU alta.
4. Depois de 7 dias com os ticks reduzidos, **medir a curva de CPU e rebaixar o instance size** (XL→Large→Medium se couber). Só rebaixar com métrica na mão, nunca no chute.

### Fase B — AI (alvo: −50% a −70% do gasto de gateway)
1. **Cortar o prompt fixo da LIA**: mover tabela de preços/ficha de empreendimento para consulta sob demanda (só injeta o produto que a conversa citou), em vez de mandar tudo sempre.
2. **Truncar histórico** para as últimas N mensagens + resumo curto, com teto duro de tokens de entrada.
3. **Usar modelo mais barato para tarefas simples** (classificação, detecção de intenção, follow-up automático) e reservar o flash grande para a conversa.
4. **Não chamar o modelo em turno vazio**: mensagens tipo "ok", figurinha, áudio já transcrito repetido devem ser respondidas por regra, não por LLM.
5. Ligar teto diário de chamadas por lead para evitar loop de burst.

### Fase C — Egress e frontend (alvo: −30 a −40 créditos/mês nos picos)
1. Trocar `select('*')` por colunas explícitas nas telas pesadas (Pipeline, Base Única, Agenda/Visitas — a query de `visitas` hoje puxa 27 colunas sem filtro).
2. Cachear no React Query o que hoje é refeito a cada navegação (perfil, roles, preferências, disponibilidade) com `staleTime` longo.
3. Agregações em RPC/view: devolver o número, não milhares de linhas para contar no cliente.

### Fase D — Controle
- Alerta de saldo Cloud/AI em um patamar mensal, para não descobrir no top-up.
- Revisão mensal de 5 min do breakdown por item, comparando com esta linha de base.

## Detalhes técnicos
- Fonte: ledger de créditos agrupado por `billable_item` (janelas de 30 e 90 dias), `cron.job` do banco e 7 dias de logs do AI Gateway.
- Fase A mexe em `cron.schedule` (migration) e em edge functions de worker; Fase B em `lia-chat`/`lia-whatsapp`/`lia-followup`; Fase C em hooks e queries do frontend.
- Redimensionamento de instância é ação de infraestrutura, feita só depois da medição da Fase A.
- Nada aqui altera regra de negócio: as automações continuam rodando, apenas com cadência e payload proporcionais ao uso real.

## Ordem sugerida
Fase A primeiro (85% do custo), Fase B em seguida (crescimento mais rápido), depois C e D. Cada fase entra como plano próprio, com medição antes e depois.
