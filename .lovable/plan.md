# Sem Contato: remover tentativa manual + contar tarefas como ação

## Problema 1 — Duplicação de tentativas

Hoje a etapa **Sem Contato** tem DOIS contadores de tentativa:

1. **Manual** — o corretor escolhe `0/7` num seletor ("📋 Status da Etapa → Tentativas"). Isso grava em `pipeline_leads.flag_status.tentativas` e gera o badge `☎️ X/7`.
2. **Automático** — o CRM controla via cadência (`lead_cadencia_sem_contato`), gerando o badge `📲 tentativa`.

Por isso aparece duplicado. Vamos **remover o manual** e manter só o automático do CRM.

### Mudanças (frontend, sem backend)
- `src/components/pipeline/LeadFlagControls.tsx`: remover o bloco do seletor de "Tentativas" do caso `sem_contato` (deixar de renderizar o card "Status da Etapa" para essa etapa, já que tentativa era o único campo).
- `src/lib/leadHelpers.ts`: em `getLeadSubstatusBadge`, remover o `case "sem_contato"` que monta `☎️ X/7` a partir de `flag_status.tentativas`.
- `src/components/pipeline/LeadFlagBadges.tsx`: remover o badge manual `☎️ X/7` do `sem_contato`.

O badge automático `📲` (vindo da cadência, em `CardMinimal.tsx`) permanece intacto.

## Problema 2 — Criar/concluir tarefa deve contar como ação na cadência

Hoje a cadência só avança quando entra uma atividade em `pipeline_atividades` com tipo de contato (`ligacao`, `whatsapp`, `nota`, etc.).

- **Concluir tarefa**: já registra atividade com `tipo = tipo_contato` (ligação/whatsapp/...), então **já conta**.
- **Criar tarefa**: registra atividade com `tipo = 'tarefa'`, que **não está** na lista permitida do gatilho `fn_cadencia_sc_avancar_acao` → hoje não conta.

### Mudança (migration)
Atualizar a função `fn_cadencia_sc_avancar_acao` para incluir `'tarefa'` na lista de tipos que avançam a cadência. Assim, **criar** uma tarefa passa a contar como tentativa de contato, e **concluir** continua contando (como já acontece).

## Detalhes técnicos
- Gatilho atual: `trg_cadencia_sc_avancar_acao AFTER INSERT ON pipeline_atividades` → `fn_cadencia_sc_avancar_acao()`. Só precisa adicionar `'tarefa'` ao `NEW.tipo IN (...)`.
- O campo `flag_status.tentativas` deixa de ser escrito/lido na UI; não há função de banco dependente dele (verificado), então nenhum dado precisa ser migrado.
- Nenhuma alteração no motor de estagnação, que já considera ações humanas e tarefas futuras.

## Verificação
- Conferir no preview que a etapa Sem Contato mostra apenas o badge automático `📲` e não o `☎️ X/7` manual.
- Criar uma tarefa num lead em Sem Contato e confirmar que `lead_cadencia_sem_contato.tentativa_atual` avança.
