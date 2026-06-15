# Corrigir "Retorno ao vivo" travado durante disparo

## Sintoma
Na aba **Retorno ao vivo** (`/central-nutricao`), enquanto um disparo está em andamento, o painel fica preso no spinner ("carregando") ou mostra "nenhuma entrada encontrada", em vez de exibir o andamento real.

## Causa raiz
Em `src/components/central-nutricao/AuditoriaWebhookTab.tsx`:

- Há uma assinatura realtime que, a **cada** insert/update na tabela `reengajamento_meta_disparos`, chama `qc.invalidateQueries(["auditoria-meta-webhook"])`.
- Durante um disparo ativo, a tabela recebe **dezenas/centenas de escritas por minuto** (cada mensagem muda status: sent → delivered → read…).
- Cada invalidação **cancela a busca em andamento e reinicia**. Como os eventos chegam mais rápido do que a query consegue terminar (ela faz 3 consultas em sequência: disparos + `count exact`, `pipeline_leads`, `profiles`), a busca **nunca conclui** → `isLoading` nunca vira `false` → spinner eterno.

## Correção (1 arquivo: `AuditoriaWebhookTab.tsx`)

1. **Throttle da invalidação realtime**: em vez de invalidar a cada evento, acumular os eventos e invalidar no máximo **uma vez a cada ~4s** (via `useRef` com timer). Isso deixa a busca respirar e concluir, mantendo a atualização "ao vivo" suave.

2. **`placeholderData: keepPreviousData`** na query `auditoria-meta-webhook`: assim, depois do primeiro carregamento, refetches **mantêm os dados anteriores na tela** em vez de voltar ao spinner de página inteira. (import de `keepPreviousData` do `@tanstack/react-query`.)

3. **Aliviar o custo da contagem**: trocar `count: "exact"` por `count: "estimated"` na consulta principal, reduzindo o tempo de cada refetch sob carga de escrita (o número "X de Y carregados" continua útil como referência aproximada). O resumo numérico preciso de hoje já vem da RPC `reengajamento_resumo_hoje`, que não é afetada.

## Resultado esperado
- Abrir "Retorno ao vivo" durante um disparo → a tabela carrega e passa a atualizar suavemente (a cada poucos segundos), mostrando enviados/entregues/lidos/respostas em tempo quase real.
- Sem mais spinner eterno nem "nenhuma entrada" enquanto o disparo roda.

## Validação
- Com o disparo atual em andamento, abrir a aba e confirmar que as linhas aparecem e os contadores avançam.
- Confirmar que o indicador "Ao vivo" fica verde e os números sobem sem travar.

## Detalhe técnico
Arquivo único: `src/components/central-nutricao/AuditoriaWebhookTab.tsx`. Sem migração, sem mudança de RLS, sem mexer em edge functions.
