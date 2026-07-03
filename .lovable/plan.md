## Problema

No pipeline do CEO/Admin as **etapas (colunas) do Kanban falham ao carregar**, então o board fica vazio ("Nenhum lead nesta etapa") mesmo havendo ~1.806 leads ativos. Confirmado pelos logs:

```text
[usePipeline] Partial load failure: ["stages","segmentos"]
TypeError: Failed to fetch
```

Os leads chegam, mas sem `stages` não há colunas onde exibi-los.

## Causa raiz

Em `src/hooks/usePipeline.ts`, o efeito de carga dispara as três queries **em paralelo**:

```text
Promise.allSettled([ loadStages(), loadSegmentos(), loadLeads() ])
```

Para o CEO, `loadLeads()` traz **todos os leads da empresa** (query enorme, 40+ colunas, paginada). Rodando ao mesmo tempo que as queries leves de etapas/segmentos, a conexão satura e as requisições pequenas caem com `Failed to fetch`. Como `loadStages` propaga o erro e não há cache, o board renderiza sem colunas → parece "sem leads". Nas demais roles o volume é pequeno, por isso só o CEO é afetado. O próprio código já tem o comentário "ORDEM: stages PRIMEIRO", mas isso nunca foi aplicado no nível de rede.

## Correção

Reordenar a carga em `usePipeline.ts` para garantir que as queries **leves e críticas (etapas/segmentos) rodem e concluam antes** da query pesada de leads, evitando a disputa de conexão.

1. **Sequenciar as cargas** no efeito principal (por volta das linhas 419-461):
   - Primeiro: `await Promise.allSettled([ loadStages(), loadSegmentos() ])` (rápidas, garantem as colunas).
   - Depois: `await loadLeads()` (pesada).
   - Manter os `withTimeout` atuais e a mesma lógica de detecção de falha parcial / `staleSince` / `setError`.

2. **Robustez das etapas** (`loadStages`): como as colunas são críticas, em caso de falha de rede transitória não deixar o board vazio — reaproveitar `stagesRef.current` (cache do último snapshot válido) em vez de exibir "sem leads". A função já não sobrescreve com `[]`; o ganho vem de garantir que a query de etapas não concorra mais com a de leads.

3. **Aplicar a mesma ordenação no `reload()`** (por volta das linhas 839-843), que hoje também dispara os três em paralelo.

4. **(Opcional, mesma direção) Aliviar a carga do CEO**: a resolução de nomes de corretores usa um `.or(user_id.in.(...),id.in.(...))` com todos os IDs da empresa. Não é a causa do board vazio (roda depois do `setLeads`), então fica fora do escopo desta correção salvo se você quiser otimizar performance depois.

## Validação

- Reproduzir com o usuário CEO no preview (desktop e celular): as colunas do Kanban devem aparecer e os leads distribuídos por etapa.
- Confirmar nos logs do console que não há mais `Partial load failure: ["stages", ...]` na carga inicial do pipeline do CEO.

## Arquivos afetados

- `src/hooks/usePipeline.ts` (efeito de carga inicial e `reload`).

Nenhuma mudança de banco/RLS necessária — os dados existem e as permissões estão corretas; é ordem de carregamento no cliente.