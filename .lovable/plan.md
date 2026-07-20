# Plano — 3 ajustes no fluxo de conclusão de tarefa

## 1) Sem Contato: eliminar "Agendar" manual em tarefas de cadência

**Arquivo:** `src/components/pipeline/task-completion/CompletionForm.tsx`

**Diagnóstico confirmado no código:**
- `semContato.requiresNextTask` já é calculado em `TaskCompletionDialog.tsx` como `!finalAttempt && tarefaOrigem === "cadencia_sem_contato"` (na verdade, hoje ele é `!finalAttempt && !isCadenciaTask` — inverso do necessário; ver "risco" abaixo). Precisa ser revisto lá também.
- O card `AgendarCard`/`QualificacaoPillsBlock` renderiza quando `outcome === "agendar"` (linha 457).
- `OnlyCompleteBlock` recebe `onBackToAgendar` (linha 502), que só é `undefined` quando `finalAttempt`. Para cadência não-final, o botão "← Agendar" fica ativo e permite reintroduzir `outcome="agendar"` → `completeLeadTask.ts` cria tarefa manual sobre a que o trigger do banco já vai criar.
- O link "Só concluir, sem agendar próxima" (linha 532) é escondido quando `requiresNextTask`, forçando o corretor pro Agendar.

**Mudança de comportamento:**
- Para `tarefaOrigem === "cadencia_sem_contato"` e não-final (`requiresNextTask === true`):
  - Forçar `outcome = "concluir"` de saída (já feito no `useEffect` do dialog, mas hoje isso vai pra `agendar`, ver risco 1).
  - Em `CompletionForm`: quando `semContato.enabled && semContato.requiresNextTask`, renderizar SÓ o header + Canal + Resultado + Observação + `SemContatoInfoBanner` ("Tentativa X registrada — a próxima é criada automaticamente pela cadência") + footer com botão Concluir. Não renderizar `AgendarCard`, nem `OnlyCompleteBlock` (o banner substitui), nem o toggle "Ajustar manualmente", nem o link "Só concluir, sem agendar", nem os botões Descartar/Inativar (opcional — decisão abaixo).
  - Passar `onBackToAgendar={undefined}` em todos os casos de cadência não-final (não só finalAttempt).
- Tentativa final (T7) e tarefas sem `tarefaOrigem === "cadencia_sem_contato"` no stage Sem Contato: comportamento atual mantido.

**Arquivo secundário:** `src/components/pipeline/task-completion/TaskCompletionDialog.tsx`
- Corrigir a lógica de `requiresNextTask`. Hoje (linhas ~200): `requiresNextTask: !finalAttempt && !isCadenciaTask`. Isso significa que uma tarefa DA cadência (a que queremos travar) tem `requiresNextTask=false`, e o `useEffect` seguinte força `outcome=concluir`. **Reler antes de mudar** — pode ser que a intenção original já esteja correta e o bug seja só o `onBackToAgendar` no `OnlyCompleteBlock` deixar o corretor voltar. Vou confirmar no build lendo o fluxo end-to-end antes de tocar aqui; **se `requiresNextTask` já vem `false` para cadência não-final, a correção é APENAS remover o `onBackToAgendar` desse caso e esconder Descartar/Inativar/link "Só concluir"**. Isso é o mais provável.

**Decisão a confirmar com o usuário:** manter ou esconder os botões "Descartar/Inativar" nesse popup travado? Recomendo **manter** — o corretor pode legitimamente querer encerrar o lead ao concluir uma tentativa; o que queremos travar é só a criação de tarefa manual paralela.

## 2) Qualificação: fluxo enxuto para "Confirmar visita"

**Arquivos:**
- `src/components/pipeline/task-completion/CompletionForm.tsx` (header + Canal + `QualificacaoPillsBlock`)
- `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` (detectar contexto e inicializar estado)
- `src/components/pipeline/QualificacaoChecklistCard.tsx` (`VisitaDatePicker` — reorganização visual)

**Detecção do contexto "confirmar visita":**
- `qualInfo.enabled === true` E `qualInfo.currentStatus === "alinhando_visita"`.
- Nesse caso, no `TaskCompletionDialog` já pré-selecionar `qualPillStatus = "alinhando_visita"` (já é feito).

**Mudanças no `CompletionForm`:**
- **Header (linha 342):** deduplicar nome. Nova regra do `subtitleText`:
  - Se `leadNome && !tarefaTitulo.toLowerCase().includes(leadNome.toLowerCase())` → `${tarefaTitulo} · ${leadNome}`.
  - Caso contrário → `tarefaTitulo` só. Cobre tanto o formato antigo ("Confirmar data da visita — Juliana") quanto o novo ("Confirmar visita às 14h · 20/07"). Aplicar globalmente (não só qualificação — é uma melhoria geral e barata).
- **Canal:** quando `qualificacao?.currentStatus === "alinhando_visita"`, esconder o bloco Canal (linhas 360-393). Manter Resultado + Observação. Isso implica auto-preencher `tipo_contato` com um default sensato para não quebrar `handleConfirm` que exige `tipoContato && resultado`. **Decisão:** setar default `tipo_contato = "whatsapp"` (é o canal mais comum para confirmar visita) no `TaskCompletionDialog` quando detectar esse caso; ou permitir undefined e ajustar a validação. Recomendo **default "whatsapp"** com um comentário no código.
- **`QualificacaoPillsBlock`:** quando `currentStatus === "alinhando_visita"`, renderizar variante enxuta:
  - Título: "A visita é pra quando?"
  - 3 botões (Hoje | Amanhã | Escolher data) na **mesma linha** (grid-cols-3), todos com o mesmo peso visual. "Escolher data" abre inline abaixo um `type="date"` + botão OK (accordion-style).
  - Campo Horário aparece **abaixo** desse grupo, único, aplicando-se a qualquer opção escolhida (Hoje/Amanhã/customizada).
  - Warning "Máximo 7 dias — ajustado para dd/mm" reaproveitado como está.
  - Link discreto abaixo: "Trocar etapa" → toggle que revela as 6 pills originais (fallback quando conversa mudou de rumo).

**Mudanças no `VisitaDatePicker`:**
- Adicionar prop `variant?: "default" | "confirmar-visita"`.
- Na `variant="confirmar-visita"`: os 3 botões (Hoje/Amanhã/Escolher data) em `grid-cols-3`; "Escolher data" vira toggle que expande input `type="date"` inline; horário fica em uma única seção abaixo dos 3.
- Chamado via prop nova em `QualificacaoPillsBlock` — no card do lead (`QualificacaoEtapaCard`) continua usando o layout atual (`variant="default"`).

## 3) Kanban Card: título específico substitui rótulo genérico

**Arquivo:** `src/components/pipeline/CardMinimal.tsx`

**Lógica atual (linhas 412-449):**
- Renderiza `<strong>{ACTION_LABEL[actionType]}</strong> {actionWhen}` — ex: "**Ligação** hoje 14h".
- `actionType` vem de `parseTaskActionType(proximaTarefa?.tipo)`.
- Substatus (linhas 350-354) renderiza `{substatus.label}` no header — ex: "🗓️ Alinhando visita".

**Detecção "título específico":**
- `proximaTarefa?.titulo` existe (tarefas legadas podem ter `null`).
- Heurística leve: título contém `" · "` (separador `dd/mm` das tarefas novas) **ou** contém `" às "` (formato "Enviar opções às 11h"). Basta uma das duas. Isso captura o formato do `qualificacaoTaskEngine.buildQualificacaoTaskTitle` e é robusto a futuras variações do motor.
- Se detectado → `hasSpecificTitle = true`.

**Mudanças:**
- Novo memo `hasSpecificTitle = useMemo(() => { const t = proximaTarefa?.titulo || ""; return t.includes(" · ") || t.includes(" às "); }, [proximaTarefa?.titulo])`.
- Na action line: `hasSpecificTitle` → renderizar `<strong>{proximaTarefa.titulo}</strong>` sem `actionWhen` (data/hora já estão no título) e sem `ACTION_LABEL[actionType]`. Manter o ícone `ACTION_ICON[actionType]` à esquerda (contexto visual).
- No header (linha 350): `{substatus && !hasSpecificTitle && (...)}` — esconder substatus quando o título já carrega a info.

**Preservado:**
- Fallback: sem título específico → comportamento atual (`ACTION_LABEL[actionType]` + `actionWhen` + substatus badge).
- Estado "sem" (tarefa ausente) → mantém "⚠ Definir tarefa" e substatus (não há título pra mostrar).
- Estado "atrasada" mantém a cor vermelha no bloco strong.

## Arquivos tocados

1. `src/components/pipeline/task-completion/CompletionForm.tsx` — 3 mudanças (Sem Contato lock, Qualif variant, header dedup).
2. `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` — default `tipo_contato` para "confirmar visita" + verificar `requiresNextTask`.
3. `src/components/pipeline/QualificacaoChecklistCard.tsx` — prop `variant` no `VisitaDatePicker`.
4. `src/components/pipeline/CardMinimal.tsx` — `hasSpecificTitle` + render condicional.

## Riscos e casos de borda

- **R1 — Sem Contato `requiresNextTask` invertido:** a lógica atual em `TaskCompletionDialog` (`!finalAttempt && !isCadenciaTask`) pode estar semanticamente diferente do que o nome sugere. Antes de codar, **releio o fluxo end-to-end** e confirmo se a variável significa "o SISTEMA vai criar a próxima" (então tem que ser `isCadenciaTask && !finalAttempt`) ou "o USUÁRIO precisa criar". Provavelmente é a segunda e o bug do usuário é só o botão "← Agendar" no `OnlyCompleteBlock` — nesse caso a fix é cirúrgica.
- **R2 — Tarefas de cadência com `tarefaOrigem` null:** existem tarefas antigas em Sem Contato criadas antes do trigger — não são pegas pelo lock. Aceitável: o corretor ainda pode agendar manualmente nelas (não é o bug reportado). Documentar na PR.
- **R3 — Título antigo com nome embutido no header:** a heurística `tarefaTitulo.includes(leadNome)` é case-sensitive por padrão — uso `.toLowerCase()` nos dois lados. Nomes muito curtos (ex: "Ana") podem dar falso positivo se o título tiver "Ana" por outro motivo — risco baixo em produção, mas aceito.
- **R4 — Default `tipo_contato="whatsapp"` em Confirmar Visita:** grava um valor que o corretor não escolheu. Mitigação: manter o campo visível mas colapsado ("Canal: WhatsApp · alterar") — decisão do usuário confirmar. Recomendo esconder de vez pra manter o popup enxuto (é o que ele pediu).
- **R5 — Heurística `hasSpecificTitle` no CardMinimal:** tarefas manuais que o corretor digitou com " · " no título vão parecer específicas. Aceitável: o título dele é literalmente o que ele quer ver, o comportamento continua correto (mostra o que ele escreveu, esconde substatus redundante).
- **R6 — Substatus escondido em Qualificação:** o badge "🗓️ Alinhando visita" some do topo do card quando o título já diz "Confirmar visita às 14h · 20/07". Isso é o objetivo, mas o gestor perde a visão de "quantos leads meus estão em Alinhando visita" batendo o olho. Mitigação: filtros de kanban por substatus continuam funcionando; badge só some do card individual, não do sistema.
- **R7 — Tarefas fora de Qualificação com título específico manual:** um corretor pode digitar "Ligar às 15h" e cair na heurística. Comportamento resultante: mostra o título, esconde substatus (se houver). Aceitável — melhoria acidental.

## Ordem de execução

1. `CompletionForm` header dedup (baixo risco, isolado).
2. `CardMinimal` (baixo risco, isolado, valor alto).
3. `VisitaDatePicker` variant + `QualificacaoPillsBlock` variante.
4. `CompletionForm` lock de Sem Contato (mais delicado — release por último, testar cenário T1-T6 + T7 + tarefa sem origem).

Typecheck após cada passo. Não escrevo código até tua confirmação.
