# Corrigir banner "reconectando" preso na visão CEO

## Diagnóstico

O aviso "Dados de há 7min — reconectando…" é o componente `StaleDataBadge`, controlado pelo estado `staleSince` no hook `src/hooks/usePipeline.ts`. Os leads **estão carregando normalmente** (a tela mostra 1.662 leads e os KPIs preenchidos) — o problema é que o banner **nunca some**, mesmo depois de recarregar.

Causa raiz: `staleSince` só é **limpo** (`setStaleSince(null)`) dentro do `useEffect` de carga inicial (linha ~465). Esse efeito roda essencialmente uma vez. Os outros caminhos que recarregam os leads **não limpam** o banner nem atualizam o marcador de sucesso:

- `reload()` (botão **"Atualizar agora"**, linha ~862): recarrega etapas/segmentos/leads via `Promise.allSettled`, mas **nunca** chama `setStaleSince(null)` nem atualiza `lastSuccessAtRef` em caso de sucesso. Ou seja, clicar em "Atualizar agora" busca os dados de novo, mas o banner continua lá.
- O reload por troca de aba (visibility, linha ~571): chama `loadLeads()` direto e também não mexe em `staleSince`.

Como a query de leads do CEO é pesada (empresa inteira, ~1.800 leads paginados), basta uma falha/timeout de uma recarga em segundo plano — depois de um sucesso inicial — para `staleSince` ser setado. A partir daí ele fica preso para sempre.

## Correção (somente frontend)

Em `src/hooks/usePipeline.ts`:

1. **Centralizar o "marcar sucesso"**: criar um helper interno `markLoadSuccess()` que faz `lastSuccessAtRef.current = new Date()` e `setStaleSince(null)`, e usá-lo no `useEffect` inicial no lugar do código atual.

2. **`reload()`**: após os `Promise.allSettled`, avaliar os resultados. Se etapas e leads tiverem sucesso, chamar `markLoadSuccess()`. Se falharem mas houver cache, atualizar `staleSince` para o último sucesso (mesmo critério do efeito inicial). Assim "Atualizar agora" realmente remove o banner quando os dados voltam.

3. **Reload por visibility** (linha ~565): ao concluir `loadLeads()` com sucesso, chamar `markLoadSuccess()`; em falha com cache, sinalizar stale de forma consistente.

4. **Rede de segurança (opcional, recomendada)**: quando `staleSince` estiver ativo, agendar uma re-tentativa automática leve (ex.: um `setTimeout`/intervalo de ~30–60s) que chama `reload()` até voltar a ter sucesso, para o banner se auto-resolver sem o usuário precisar clicar. Já existe um `useBackendHealth` que confirma se o backend está vivo; podemos disparar a re-tentativa só quando o ping estiver saudável, evitando marteladas na conexão.

## Validação

- Reproduzir na visão CEO em `/pipeline-leads` via navegador autenticado (Playwright), confirmando que os leads aparecem.
- Forçar o estado `staleSince` (ou aguardar uma recarga) e verificar que:
  - clicar em **"Atualizar agora"** remove o banner quando a recarga tem sucesso;
  - a re-tentativa automática (se implementada) faz o banner sumir sozinho em até ~1 min;
  - o banner só permanece enquanto realmente houver falha de recarga.
- Confirmar no console que não há loop de "Partial load failure".

## Escopo

Mudança isolada em `src/hooks/usePipeline.ts` (lógica de estado do banner). Sem alterações de schema, RLS ou de outras telas. A performance da query pesada do CEO não é alterada aqui — se após esta correção o banner ainda piscar por timeouts frequentes, tratamos performance/índices em um passo separado.
