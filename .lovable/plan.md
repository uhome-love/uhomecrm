# Análise de gastos de créditos (top-ups) — Uhome CRM

## Onde o dinheiro está indo (dados reais da workspace)

Período 23/mai a 20/ago (90 dias): **6.807 créditos** consumidos.

| Item | 90 dias | % |
|---|---|---|
| Mensagens em Build mode | 4.744 | 69,7% |
| Mensagens em Plan mode | 816 | 12,0% |
| Cloud compute XL | 661 | 9,7% |
| Cloud compute Large | 366 | 5,4% |
| Cloud egress (tráfego) | 155 | 2,3% |
| AI Gateway (Gemini, embeddings) | ~46 | 0,7% |
| Realtime / functions / storage | ~19 | 0,3% |

Últimos 30 dias (21/jul a 20/ago): **2.968 créditos** — mês anterior: **2.156**. Ou seja, o consumo *subiu ~38%* no último mês.

Plano cobre 400 créditos/mês + 400 de rollover + 5/dia. Consumo real ≈ 2.100–3.000/mês → daí os top-ups constantes (12.098 créditos comprados em top-up até hoje, restam 103).

## Por que se gasta tanto

1. **Conversa com o agente é 82% do custo.** Não é infraestrutura, não é IA do app — é volume de mensagens de Build e Plan. Cada mensagem custa créditos independentemente do tamanho da mudança; sessões longas de "vai e volta" (ajuste visual, debug em loop, pedido vago que precisa de 5 idas) multiplicam o custo.
2. **Plan mode virou 12% sozinho.** O fluxo obrigatório mockup → plano → validação → build é ótimo para qualidade, mas cada rodada de revisão de plano é uma mensagem cheia.
3. **Banco em compute Large + picos XL = ~330 créditos/mês** (11% do total) rodando 24/7. Parte disso é o próprio uso do CRM (crons de hora em hora, reengajamento, sync Meta, polling), parte é dimensionamento.
4. **Egress de 155 créditos** em 90 dias indica consultas trazendo linhas/colunas demais para o frontend (pipeline com 114 colunas, listas sem `.select()` enxuto).
5. **IA do app (Gemini/HOMI/LIA) é irrelevante no custo** (<1%). Não é aí que se economiza.

## Plano de redução (ordem de impacto)

### Fase 1 — Disciplina de conversa (alvo: −30% a −40%, sem tocar em código)
- Agrupar pedidos: um briefing com 5 itens relacionados em vez de 5 mensagens separadas.
- Anexar print + descrição do comportamento esperado logo na primeira mensagem (evita 2–3 rodadas de diagnóstico).
- Usar Plan mode só para mudanças estruturais; correções pequenas e óbvias vão direto para Build.
- Ajustes puramente visuais (cor, espaçamento, texto) via edição visual/Dev mode em vez de mensagem ao agente.
- Encerrar chats muito longos e abrir novo por tema: contexto gigante encarece cada mensagem.
- Definir critério de "pronto" antes de começar, para não abrir rodadas de refinamento em cima do já feito.

### Fase 2 — Reduzir custo de Cloud (alvo: −150 a −250 créditos/mês)
- Auditar por que o compute escala para XL: identificar queries lentas e crons concorrentes, e reagendar os pesados (reengajamento, sync Meta, backfills) para fora do horário comercial.
- Revisar índices nas tabelas mais consultadas (`pipeline_leads`, `pipeline_tarefas`, `pipeline_atividades`) — CPU alta costuma ser sequential scan.
- Avaliar rebaixar o instance size depois que os picos sumirem, monitorando por uma semana.

### Fase 3 — Reduzir egress (alvo: −40 créditos/mês)
- Trocar `select('*')` por listas de colunas explícitas nas telas de maior tráfego (Pipeline, Base Única, Central de Marketing).
- Paginar de fato o que hoje carrega milhares de linhas para filtrar no cliente.
- Mover agregações pesadas para RPC/views (retornar o número, não as linhas).

### Fase 4 — Controle e visibilidade
- Configurar alerta de crédito em um patamar mensal (ex.: 70% do orçamento) para não descobrir o estouro no top-up.
- Revisão mensal de 5 minutos do breakdown por item para ver se a curva está caindo.

## Detalhes técnicos
- Fonte: ledger de créditos da workspace agrupado por `billable_item`, janelas de 30 e 90 dias.
- Nenhuma alteração de código nas Fases 1 e 4. Fase 2 mexe em agendamento de crons e índices (migrations). Fase 3 mexe em queries do frontend e possíveis views novas.
- Fase 2 e 3 exigem antes uma auditoria de slow queries e das telas de maior tráfego; cada uma vira uma fase própria com plano específico.

## Ordem sugerida
Fase 1 imediatamente (é onde estão 82% do custo e não precisa de código). Depois auditoria de Cloud (Fase 2), depois egress (Fase 3), com Fase 4 em paralelo.
