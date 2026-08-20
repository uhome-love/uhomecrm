# Redução dos top-ups de Cloud & AI — plano de execução (revisado com a régua do Lucas)

Régua: **cortar custo sem perder nenhuma qualidade, função ou comportamento do sistema.** Nada de mudança de regra de negócio, nada de degradar atendimento.

Foco: top-ups da tela **Cloud & AI balance** (US$ 211,58 Cloud + US$ 35,31 AI), não os créditos de mensagem do editor.

## 1. Diagnóstico (linha de base medida)

Últimos 30 dias (21/jul → 20/ago), só itens de Cloud + AI:

| Item | Créditos 30d | % |
|---|---|---|
| Cloud compute Large | 167,8 | 43% |
| Cloud compute XL | 163,3 | 42% |
| AI Gateway gemini-3.6-flash | 32,2 | 8% |
| AI Gateway outros modelos + embeddings | 11,7 | 3% |
| Cloud egress | 8,6 | 2% |
| Cloud functions | 4,3 | 1% |
| Realtime + cached egress + storage | 3,7 | 1% |

Mês anterior (21/jun → 20/jul): compute 332, egress **43,5**, AI ~2.

- **85% é compute do banco**, cobrado por hora de instância ligada.
- Existem **7 crons a cada minuto**, 1 a cada 2 min, 3 a cada 5 min, 2 a cada 10 min — ~15 mil execuções/dia, muitas achando fila vazia.
- **AI**: 3.753 chamadas em 7 dias, ~13.000 tokens de entrada por turno (95% do custo é input).
- Egress sobe quando telas puxam tabela inteira (ex.: `visitas` com 27 colunas sem filtro).

## 2. Bloco A — Segue já (economia sem risco de qualidade)

**A1. Índices nas colunas de fila** que os workers varrem a cada minuto (`status`, `vence_em`, `aceite_expira_em`, `processado_em` e equivalentes). Mesmo comportamento, sem sequential scan.

**A2. Early-exit barato em cada worker**: começar por um `SELECT ... LIMIT 1` indexado e sair sem abrir transação quando não há fila. O job faz exatamente a mesma coisa quando há trabalho.

**A3. Espaçar só os crons pesados e não sensíveis a tempo** — candidatos: `typesense-sync-cron` (1 min), `typesense-batch-reindex` (2 min), `mailgun-batch-send` (1 min), limpezas e sweeps. Cada candidato é listado com justificativa e aprovado item a item antes de mudar o schedule. Nenhum cron do Bloco C entra aqui.

**A4. Frontend**: colunas explícitas no lugar de `select('*')`, agregações via RPC, e cache do React Query com a regra pedida —
- cache **curto** para dado vivo: notificações, disponibilidade, roleta, aceite pendente;
- cache **longo** só para estático: perfil, papéis/roles, preferências, listas de empreendimento.
Cada tela alterada é testada campo a campo depois da mudança (checklist por tela, sem "achismo").

**A5. IA sem chamada em turno vazio**: mensagem tipo "ok", figurinha, duplicata e eco não disparam modelo — resposta por regra. Mais um teto de rajada por lead como trava de segurança. Não altera o atendimento.

**A6. Alertas de custo** de saldo Cloud/AI + revisão mensal de 5 min do breakdown contra esta linha de base.

> Observação de coordenação: A5 toca comportamento de gatilho da LIA. **Não será implementado sem alinhamento prévio com você**, junto do combinado do Bloco D.

## 3. Bloco B — Segue com medição antes/depois e reversível

**B1. Redimensionar a instância** — só depois de 7 dias com A1–A3 no ar, com a curva real de CPU/memória na mão e folga sobre o pico. Reversível na hora. Nunca no chute.

**B2. Modelo mais barato apenas em tarefas internas** (resumo, classificação, detecção de intenção) — nunca na resposta ao cliente. Entra só se passar em teste lado a lado com amostra real; se piorar, volta o modelo atual.

## 4. Bloco C — Não mexer

**C1. Prompt e base de conhecimento da conversa da LIA** ficam como estão. Qualidade de atendimento e conformidade acima da economia — é fatia pequena do custo.

**C2. Crons sensíveis a tempo mantêm a frequência atual**: `lead-escalation-every-minute`, `expirar-aceites-roleta`, `meta-capi-dispatch-5min`, `lia-poll-meta-1min`, `reengajamento-worker-tick`, `lia-followup-15min`. Atraso aqui vira lead frio.

## 5. Bloco D — Regra de coordenação com a LIA

`lia-chat`, `lia-whatsapp`, `lia-followup` e os crons da LIA estão sendo mexidos em paralelo pelo seu lado. **Nenhuma alteração nessas funções sem alinhamento prévio com você**, inclusive A5 e B2. Se alguma otimização depender delas, ela é proposta e fica parada até seu OK.

## 6. Método de execução

- Uma fase por vez, com medição antes e depois (créditos por `billable_item` + curva de compute).
- Tudo reversível por alguns dias antes de virar definitivo: schedules antigos anotados, índices podem cair, queries de frontend em commits separados por tela.
- Nenhuma fase entra em build sem mockup/plano específico aprovado, conforme o padrão de trabalho.

### Ordem
A1 + A2 (maior efeito, risco zero) → A4 por tela → A3 item a item com sua aprovação → A6 → medir 7 dias → B1 → B2 (se passar no teste). A5 só depois do alinhamento do Bloco D.

## 7. Detalhes técnicos
- Fonte: ledger de créditos por `billable_item` (30 e 90 dias), `cron.job` do banco, 7 dias de logs do AI Gateway.
- A1 e A3 entram como migration (só DDL / `cron.schedule`), respeitando o limite de migrations por dia e janela fora do pico.
- A2 mexe nas edge functions de worker que não são da LIA.
- A4 mexe em hooks e queries do frontend, um commit por tela para permitir rollback isolado.
- B1 é ação de infraestrutura, feita só com métrica na mão.
