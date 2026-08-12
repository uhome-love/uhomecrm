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

## Filtro "Feitos hoje"
Na linha de chips de foco das Prioridades entra um chip **"Feitos hoje (N)"**, à direita dos demais. Ao clicar, a lista mostra os leads que o corretor tocou hoje (BRT), em vez da fila:

- Card enxuto, em tom "concluído" (borda verde, sem botão Registrar): nome, etapa, hora do registro e o **texto do último registro** ("o que foi feito").
- Clicar abre o lead; um botão discreto **"Voltar pra fila"** desfaz o auto-dispensa daquele card, caso tenha registrado por engano.
- Serve de comprovante do dia: o corretor vê o que já atacou e o gestor vê o mesmo na tela dele.

## Detalhes técnicos

Arquivos: `src/pages/AgendaCorretor.tsx` e `src/hooks/useFilaDoDia.ts` (frontend apenas — nada de banco, RPC ou edge function).

- `setRegistrar({...})` dos cards de prioridade passa a marcar a origem (`origem: "fila"`).
- No `onSaved` do `RegistrarAtividadeModal`: se a origem for `"fila"`, chamar `dispensarLead(id)` (`src/lib/filaDispensados.ts`, já existente, janela de 24h em localStorage) antes de `invalidar()`.
- Guardar `proximoDestaqueId` = id do card seguinte na lista `prioridadesFiltradas` no momento do save; após o refetch, `scrollIntoView({ behavior: "smooth", block: "center" })` no card e aplicar classe de destaque temporária (limpa por `setTimeout`).
- Cards ganham `ref`/`data-lead-id` para permitir o scroll.
- `useFilaDoDia` passa a devolver `feitosHoje: LeadFila[]` — leads do corretor cujo `ultimo_toque_at` cai no dia BRT de hoje, ordenados do mais recente pro mais antigo, com `ultimo_registro` e hora. Usa a mesma consulta de leads já existente (sem query nova).
- `filaDispensados.ts` ganha `restaurarLead(id)` para o "Voltar pra fila".
- Sem mudança na ordenação da fila, nos gatilhos ou nas regras de saúde/toque.


## Fora de escopo
- Modo "um lead por vez" em tela cheia.
- Mudar critérios da fila ou de `ultimo_toque_at`.
