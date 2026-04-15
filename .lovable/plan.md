

# Gestão de Equipe no WhatsApp Inbox

## Resumo

Adicionar seletor de corretor no WhatsApp Inbox para gestores e admins, permitindo visualizar e monitorar conversas da equipe em modo leitura.

## Arquivos a criar/editar

### 1. Criar `src/components/whatsapp/CorretorSelector.tsx` (novo)

Componente com chips clicáveis: "Todos" + cada corretor da equipe. Mostra iniciais + primeiro nome. Chip ativo destacado em azul. Recebe `corretores`, `selectedCorretorId`, `onSelect`.

### 2. Editar `src/pages/WhatsAppInbox.tsx`

**Novos estados:**
- `corretores: { id: string; nome: string; userId: string }[]`
- `selectedCorretorId: string | null` (profiles.id do corretor filtrado)
- `isReadOnly: boolean` (true quando vendo conversa de outro)

**Lógica de carregamento dos corretores:**
- Usar `useUserRole()` para detectar isGestor/isAdmin
- Gestor: query `team_members` com `gerente_id = user.id` + join profiles
- Admin: query todos os profiles com user_id em team_members ativos

**Alterar `loadConversations`:**
- Se `selectedCorretorId` definido: filtrar `corretor_id = selectedCorretorId`
- Se null (Todos) e isGestor/isAdmin: filtrar `corretor_id IN (lista de profiles.id da equipe)`
- Corretor: manter lógica atual (próprio profileId)

**Alterar `loadSuggestions`:**
- Esconder follow-up e new leads quando em modo leitura (não faz sentido sugerir para outro corretor)

**Calcular `isReadOnly`:**
- `selectedCorretorId !== null && selectedCorretorId !== profileId`

**Renderização:**
- Mostrar `CorretorSelector` acima da `ConversationList` quando isGestor ou isAdmin
- Passar `isReadOnly` para `ConversationThread` e `LeadPanel`
- Passar `corretorNome` do corretor selecionado para o banner

### 3. Editar `src/components/whatsapp/ConversationList.tsx`

**Nova prop opcional:** `corretorMap?: Map<string, string>` (profileId → nome)

**Nova prop em ConversationItem:** `corretorId?: string`

Quando `corretorMap` presente e item tem `corretorId`: mostrar chip pequeno com iniciais do corretor ao lado do nome do lead.

### 4. Editar `src/components/whatsapp/ConversationThread.tsx`

**Nova prop:** `isReadOnly?: boolean`, `readOnlyCorretorNome?: string`

Quando `isReadOnly`:
- Banner azul sutil no topo: "Modo leitura — conversa de {nome}"
- `Textarea` disabled
- Botão enviar disabled
- Barra de ações rápidas (templates, agendamento) hidden
- HOMI card visível mas sem botões de ação

### 5. Editar `src/components/whatsapp/LeadPanel.tsx`

**Nova prop:** `isReadOnly?: boolean`

Quando `isReadOnly`: desabilitar edição inline (etapa, empreendimento, orçamento).

### 6. Editar `src/components/whatsapp/HomiCopilotCard.tsx`

**Nova prop:** `isReadOnly?: boolean`

Quando `isReadOnly`: esconder botão "Usar sugestão", manter texto visível.

## Queries de dados

Para gestor:
```sql
SELECT tm.user_id, p.id as profile_id, p.nome
FROM team_members tm
JOIN profiles p ON p.user_id = tm.user_id
WHERE tm.gerente_id = :authUserId AND tm.status = 'ativo'
ORDER BY p.nome
```

Para admin: mesma query sem filtro de gerente_id (todos os team_members ativos).

A query de `whatsapp_mensagens` usa `corretor_id` que é `profiles.id`, então o filtro `.in("corretor_id", profileIds)` funciona diretamente.

## Sem alterações em

- Edge Functions
- Tabelas do banco
- Lógica do perfil corretor
- RLS policies

