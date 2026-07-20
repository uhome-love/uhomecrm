## Bug: "Confirmar visita" não recria tarefa quando pill não muda

### Diagnóstico (confirmado no código)

Em `src/components/pipeline/task-completion/TaskCompletionDialog.tsx`, no `handleConfirm`, o disparo do motor pós-`onConfirm` está guardado por:

```ts
if (
  isQualFlow &&
  qualInfo.lead &&
  qualPillStatus &&
  qualPillStatus !== qualInfo.currentStatus  // ← guard problemático
) {
  await advanceQualificacaoStatus({ ... });
}
```

No fluxo "Confirmar visita", o lead já entra no popup com `status_atendimento = "alinhando_visita"`. O corretor escolhe Hoje/Amanhã/Escolher para a data, mas **não muda de pill** — então `qualPillStatus === qualInfo.currentStatus`, o `if` é falso, o motor nunca roda, e nenhuma nova tarefa é criada. A antiga foi marcada concluída pelo `onConfirm`, e o lead fica órfão de próxima ação.

### Correção

Remover o `qualPillStatus !== qualInfo.currentStatus` da condição. Ela passa a ser:

```ts
if (isQualFlow && qualInfo.lead && qualPillStatus) {
  await advanceQualificacaoStatus({
    lead: qualInfo.lead,
    statusKey: qualPillStatus,
    dataOverride: qualDataOverride,
    horaOverride: qualHoraOverride,
    silent: true,
  });
}
```

Uma linha alterada. Nenhuma outra mudança.

### Por que é seguro para os outros casos

`advanceQualificacaoStatus` (em `src/lib/qualificacaoTaskEngine.ts`) é idempotente por design:

1. **Salva `flag_status.status_atendimento`** — se já está no mesmo valor, o `UPDATE` no lead é no-op semântico (grava o mesmo valor).
2. **Cancela TODAS as tarefas pendentes** do lead antes de criar a nova — não importa se veio de troca de pill ou de re-agendamento, o estado final é "1 tarefa pendente correta".
3. **Cria a nova tarefa** com `venceEm`/`hora` recalculados a partir de `dataOverride`/`horaOverride` (com clamp de 7 dias).

Casos cobertos após a correção:

- **Confirmar visita sem trocar pill (BUG ATUAL)**: pill `alinhando_visita` + data "Amanhã" → motor cancela a "Confirmar visita" antiga (que acabou de virar `concluida` no `onConfirm`, então já não está pendente) e cria a nova "Confirmar visita às Xh · dd/mm". ✅ resolvido.
- **Trocar etapa via fallback (fluxo que já funcionava)**: pill muda de `alinhando_visita` para, ex., `follow_up` → mesma chamada de sempre, comportamento idêntico. ✅ inalterado.
- **Fora do fluxo `alinhando_visita`** (`isQualFlow` true mas outro status): já hoje o motor era chamado quando o corretor mudava de pill; agora será chamado mesmo confirmando o mesmo pill. Como o `TaskCompletionDialog` só habilita `isQualFlow` quando `qualInfo.enabled` e o corretor está agendando algo, chamar o motor idempotentemente com o mesmo status apenas recria a tarefa daquela etapa com a data padrão — comportamento coerente com "concluir a tarefa e regerar a próxima da mesma etapa".
- **Sem Contato / não-Qualificação**: `isQualFlow` é false, nada muda.

### Arquivos

- `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` — remover `qualPillStatus !== qualInfo.currentStatus` da condição pós-`onConfirm` (1 linha).

### Verificação após implementar

- `tsgo` limpo.
- Query no banco após reproduzir o cenário: lead em `alinhando_visita`, concluir com "Amanhã" sem trocar pill → esperar exatamente 1 tarefa `pendente` com `origem = 'qualificacao_alinhando_visita'` e `vence_em = amanhã (BRT)`, e a antiga como `concluida`.
