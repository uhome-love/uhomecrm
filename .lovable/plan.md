# Agenda do corretor — "registrou, avança pro próximo"

## Como é hoje
A fila de Prioridades mostra todos os cards de uma vez, ordenados por motivo. Ao registrar atividade (⚡), a lista inteira é recarregada e o card só some se o gatilho dele deixou de existir. Não há sensação de "próximo".

## Como fica
Ao salvar a atividade de um card da fila:

1. O card **sai da fila de hoje** na hora (some com uma animação curta), mesmo que o gatilho ainda exista — igual ao que "Dispensar por hoje" já faz, mas automático e sem toast de dispensa.
2. A tela **rola até o próximo card** da fila e o destaca por ~1,5s (anel sutil na cor primária), pra dar o ritmo "próximo".
3. O contador do topo cai (ex.: 12 → 11) e, quando zera, aparece o estado "Fila zerada".
4. Se o corretor só fecha o modal sem salvar, nada muda.

Isso vale só para os cards de **Prioridades**. Cards de **Lembretes** seguem como estão (registrar já conclui o lembrete).

## Detalhes técnicos

Arquivo principal: `src/pages/AgendaCorretor.tsx` (frontend apenas — nada de banco, RPC ou edge function).

- `setRegistrar({...})` dos cards de prioridade passa a marcar a origem (`origem: "fila"`).
- No `onSaved` do `RegistrarAtividadeModal`: se a origem for `"fila"`, chamar `dispensarLead(id)` (`src/lib/filaDispensados.ts`, já existente, janela de 24h em localStorage) antes de `invalidar()`.
- Guardar `proximoDestaqueId` = id do card seguinte na lista `prioridadesFiltradas` no momento do save; após o refetch, `scrollIntoView({ behavior: "smooth", block: "center" })` no card e aplicar classe de destaque temporária (limpa por `setTimeout`).
- Cards ganham `ref`/`data-lead-id` para permitir o scroll.
- Sem mudança em `useFilaDoDia`, na ordenação, ou nas regras de saúde/toque.

## Fora de escopo
- Modo "um lead por vez" em tela cheia.
- Mudar critérios da fila ou de `ultimo_toque_at`.
