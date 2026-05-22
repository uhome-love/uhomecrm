## Problema

A corretora Andressa (e outras) está vendo na Central de Tarefas tarefas pendentes de leads que **já foram descartados ou arquivados**. Ela não consegue concluí-las em lote, então ficam poluindo o painel.

Auditoria no banco confirma o tamanho do problema:

- **543** tarefas pendentes em leads `arquivado=true`
- **538** tarefas pendentes em leads em stage do tipo `descarte`
- **20** tarefas pendentes em leads que já viraram negócio
- Total geral pendentes: 3.047

Hoje a regra `isLeadElegivel` em `MinhasTarefas.tsx` só funciona para leads que estão no `ownedLeadsMap`. Esse map é montado a partir de `pipeline_leads` com `arquivado=false`, então tarefas de leads **arquivados** caem no fallback `if (!l) return true` e continuam aparecendo. Além disso, as listas "Todas / Hoje / Amanhã / Semana" nem chamam esse filtro — só "Atrasadas" chama.

E, no fluxo de descarte/arquivamento/criação de negócio, nada cancela as tarefas pendentes daquele lead — por isso o lixo acumula.

## Solução em 3 frentes

### 1. Limpeza pontual (one-off via migração de dados)

Cancelar agora as 1.101 tarefas pendentes órfãs:

- `pipeline_tarefas.status = 'cancelada'` + `concluida_em = now()` quando:
  - lead com `arquivado = true`, **ou**
  - lead em stage `tipo = 'descarte'`, **ou**
  - lead com `negocio_id IS NOT NULL`

### 2. Trigger automático no banco (evita reincidência)

Criar trigger em `pipeline_leads` (AFTER UPDATE) que cancela tarefas pendentes do lead quando:
- `arquivado` muda para `true`, **ou**
- `stage_id` muda para uma stage do tipo `descarte`, **ou**
- `negocio_id` passa de NULL para algo

A tarefa cancelada vai com `descricao` apensada de "[Auto-cancelada: lead descartado/arquivado/virou negócio]" para o histórico ficar claro.

### 3. Defesa em profundidade no frontend (`src/pages/MinhasTarefas.tsx`)

Para tarefas que sobrarem por alguma janela de race condition:

- Enriquecer cada `pipeline_tarefas` carregada com `arquivado`, `stage_tipo`, `negocio_id` do lead (uma query a mais, paginada).
- Aplicar o filtro `isLeadElegivel` em **todas** as listas (`pendentes`, `hoje`, `amanha`, `semana`, `atrasadasTarefas`), não só em "Atrasadas".
- Manter "Concluídas" como está (histórico precisa mostrar tudo).

## Resultado esperado

- Andressa abre a Central de Tarefas e os cards 23/05 dos leads já descartados desaparecem imediatamente após a limpeza.
- Daqui pra frente, descartar/arquivar/converter um lead já cancela as tarefas pendentes dele automaticamente — sem precisar concluir uma a uma.
- Painel volta a refletir só trabalho real pendente.

## Arquivos / objetos envolvidos

- Migração SQL nova: trigger `trg_cancel_tasks_on_lead_close` + função `cancel_pipeline_tasks_on_lead_close()`.
- Insert de limpeza (via tool `insert`, não migração): UPDATE em massa em `pipeline_tarefas`.
- `src/pages/MinhasTarefas.tsx`: enriquecimento das tarefas com dados do lead + aplicação do filtro em todas as listas.

## Fora de escopo

- Não vou mexer no fluxo de criação de tarefa, em outras telas (Pipeline, Foco, Agenda), nem em `negocios_tarefas` — só a Central de Tarefas e o trigger no `pipeline_leads`.
- Não vou alterar regra de quem é "lead elegível" no resto do sistema.
