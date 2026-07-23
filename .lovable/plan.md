## Contexto
Dois pontos para resolver:
1. **Regressão de negócio na PDN falha**: Gerente Bruno tentou regredir um lead de "Em Negociação" para "Visita Realizada" na tela PDN e recebeu erro de permissão.
2. **Etapa Visita sem tarefas manuais**: Corretores não conseguem criar tarefas manuais na etapa Visita porque o sistema impede criação manual (tarefas automáticas apenas).

## Diagnóstico prévio
- A regressão na PDN chama `syncPipelineStageFromPdn()` (src/lib/pdnSyncEngine.ts), que atualiza `pipeline_leads` e depois sincroniza `pdn_entries`.
- A trigger `trg_clear_negocio_on_stage_regress` dispara quando um lead regredir para ordem < 5 (Visita), limpando `negocio_id` e arquivando o negócio.
- A RLS de `pipeline_leads` permite gestores editarem leads de sua equipe via `is_lead_in_my_team(corretor_id)`, mas a mensagem de erro indica que o update está sendo barrado.
- A criação manual de tarefa em Visita está bloqueada em `DrawerTasksTab.tsx` e `NextActionModal.tsx` com a mensagem "tarefas são automáticas".

## Plano de ação

### 1. Corrigir fluxo de regressão na PDN
- Investigar o erro exato que o update de `pipeline_leads` retorna (código/mensagem do Supabase).
- Garantir que `syncPipelineStageFromPdn` trate a regressão corretamente:
  - Não tentar criar/atualizar `negocios` quando o destino é anterior a "Em Negociação".
  - Limpar o vínculo de `negocio_id` no payload e no overlay `pdn_entries` de forma consistente.
- Ajustar a mensagem de erro para identificar se o problema é RLS, trigger ou ausência de `pipeline_lead_id`.
- Validar o botão "Regredir" na planilha e no Kanban: só exibir quando houver vínculo real com `pipeline_leads` e etapa anterior válida.

### 2. Reabilitar tarefas manuais na etapa Visita
- Remover o bloqueio rígido de criação de tarefa manual na etapa Visita.
- Manter as tarefas automáticas (`confirmar_visita`, `reagendar_visita`, `feedback_visita`) intactas.
- Restringir os presets manuais em Visita para tipos que **não conflitam** com a automação:
  - Permitidos: `Ligar`, `WhatsApp`, `Enviar material`, `Follow-up`, `Outro`.
  - Não permitidos manualmente: `Confirmar visita`, `Reagendar visita`, `Feedback pós-visita` (esses continuam automáticos).
- Adicionar aviso educativo na UI: "Etapa Visita: ações de visita são automáticas, mas você pode agendar contatos/follow-ups manualmente."
- Garantir que tarefas manuais e automáticas coexistam sem duplicar ou cancelar umas às outras.

### 3. Arquivos a alterar
- `src/lib/pdnSyncEngine.ts` — regressão segura e logs detalhados.
- `src/hooks/usePdn.ts` — sincronização do overlay após regressão.
- `src/pages/PdnGestor.tsx` — controle de exibição do botão "Regredir".
- `src/components/pipeline/drawer/DrawerTasksTab.tsx` — remover bloqueio de "Nova tarefa" em Visita.
- `src/components/pipeline/NextActionModal.tsx` — permitir agendamento manual em Visita com presets limitados.
- `src/lib/taskPresets.ts` — marcar quais presets são compatíveis com etapa Visita.

## Validação
- Testar regressão na PDN com um lead de "Em Negociação" para "Visita Realizada" usando perfil de gerente.
- Confirmar que o negócio é arquivado e o lead volta para Visita sem erro de permissão.
- Testar criação de tarefa manual em lead na etapa Visita (Ligar/WhatsApp/Follow-up) e verificar que tarefas automáticas não são afetadas.
- Verificar que presets de visita automática não aparecem na criação manual.