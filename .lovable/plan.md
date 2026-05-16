## Objetivo
Fazer com que o corretor tenha os 10 minutos completos a partir do momento em que a notificação de novo lead é efetivamente disparada no fluxo de notificação, evitando casos em que ele abre o aviso e o lead já chega expirado.

## O que vou ajustar

1. Centralizar o início do relógio no backend
- Revisar o fluxo de distribuição em `supabase/functions/distribute-lead/index.ts`.
- Fazer o timestamp usado no SLA ser definido no mesmo ponto em que a notificação/push é disparada, em vez de depender de um momento anterior da distribuição.
- Garantir que `distribuido_em` e `aceite_expira_em` sejam gravados de forma consistente no mesmo instante lógico.

2. Corrigir a origem do prazo no banco
- Atualizar a função SQL responsável pela distribuição (`distribuir_lead_atomico`) para que o prazo de aceite seja calculado a partir do momento oficial de notificação/disparo.
- Validar se hoje existe dupla gravação ou sobrescrita posterior de `distribuido_em` no edge function, e remover essa inconsistência.

3. Ajustar a UI para refletir o prazo real
- Revisar `src/hooks/usePendingLeadAlert.ts`, `src/components/pipeline/LeadAcceptanceDialog.tsx` e `src/pages/AceiteLeads.tsx`.
- Garantir que o contador mostrado ao corretor use exatamente o `aceite_expira_em` persistido no backend, sem comportamento que feche cedo ou descarte o lead antes da validação do servidor.
- Preservar o buffer já existente apenas se ele ajudar contra drift de relógio, sem mascarar expiração prematura real.

4. Validar o fluxo ponta a ponta
- Conferir o encadeamento: distribuição -> insert de notificação -> push -> tela de aceite.
- Verificar se o push abre o lead correto e se o tempo restante na tela bate com os 10 minutos esperados.
- Confirmar que aceites próximos do limite continuam funcionando normalmente.

## Arquivos previstos

```text
supabase/functions/distribute-lead/index.ts
src/hooks/usePendingLeadAlert.ts
src/components/pipeline/LeadAcceptanceDialog.tsx
src/pages/AceiteLeads.tsx
supabase/migrations/<nova_migration>.sql
```

## Detalhes técnicos
- Hoje já confirmei que existe um ponto sensível: após `distribuir_lead_atomico`, o edge `distribute-lead` ainda faz um `.update()` em `pipeline_leads` e redefine `distribuido_em` no Node/Edge side.
- A correção vai eliminar a divergência entre “momento da distribuição” e “momento percebido na notificação”.
- Se necessário, a migration vai ajustar apenas a função SQL de distribuição/aceite, sem mexer na regra da roleta além do início correto do SLA.