

# Plano: Integrar Edge Function `homi-copilot` no HomiCopilotCard

## Visão geral

Substituir o card mockado por chamada real à edge function `homi-copilot`, com estados de loading, exibição estruturada da resposta da IA, e ações reais (criar tarefa, mover etapa).

## Arquivo: `src/components/whatsapp/HomiCopilotCard.tsx`

Reescrever completamente.

### Props

```typescript
interface HomiCopilotCardProps {
  leadId: string;
  leadName: string;
  lastMessage: string;
  onUseSuggestion: (text: string) => void;
}
```

### Lógica

1. **useEffect** ao montar (ou quando `lastMessage` mudar): chamar `supabase.functions.invoke("homi-copilot", { body: { lead_id: leadId, ultima_mensagem: lastMessage } })`
2. Estados: `loading`, `data` (resposta parsed), `error`, `visible`, `editedSuggestion` (textarea editável)

### UI — Loading

Card verde com spinner + "HOMI está analisando..."

### UI — Com resposta

- Header: "HOMI Copilot" + badge de tom (emoji + cor conforme tom_detectado)
- Briefing em itálico cinza
- Textarea editável pré-preenchida com `sugestao_resposta`
- Botões:
  - "✓ Usar" → `onUseSuggestion(editedSuggestion)`
  - "Ignorar" → esconde card
  - Se `sugestao_followup != null`: botão "+ {sugestao_followup}" → insert em `pipeline_tarefas` com `pipeline_lead_id`, `titulo`, `vence_em` (amanhã 10h BRT), `status: pendente`, `tipo: follow_up` → toast sucesso
  - Se `sugestao_etapa != null`: botão "💡 Mover para {etapa}" → busca `pipeline_stages` WHERE `nome = sugestao_etapa`, update `pipeline_leads.stage_id` → toast sucesso

## Arquivo: `src/components/whatsapp/ConversationThread.tsx`

Alteração mínima: adicionar prop `leadId` ao `HomiCopilotCard` (linha 188-192).

```tsx
<HomiCopilotCard
  leadId={leadInfo.id}    // ← adicionar
  leadName={leadInfo.nome}
  lastMessage={lastMsg?.body || ""}
  onUseSuggestion={(s) => setText(s)}
/>
```

## O que NÃO será alterado

- Edge functions existentes
- Outros componentes
- Tabelas

| Arquivo | Ação |
|---|---|
| `src/components/whatsapp/HomiCopilotCard.tsx` | Reescrever |
| `src/components/whatsapp/ConversationThread.tsx` | Editar (1 linha: adicionar leadId prop) |

