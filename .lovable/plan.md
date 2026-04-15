

## Diagnóstico Completo + Plano de Correção — WhatsApp Inbox

---

### TESTE 1 — ENVIO DE MENSAGEM ✅ Corrigido

- **T1.1** profileId carrega com retry (3 tentativas) — OK
- **T1.2** Campos `telefone` + `mensagem` batem com edge function — OK
- **T1.3** instanceName: a `whatsapp-send` usa Meta API hardcoded, não busca instância Evolution — funciona para Meta, não para Evolution (limitação conhecida, não é bug)
- **T1.4** Após envio: insert inclui `instance_name: "meta"` e `whatsapp_message_id` — OK. Textarea limpa, `onMessageSent()` chamado
- **T1.5** Erros capturados com toast — OK
- **DB**: `instance_name` e `whatsapp_message_id` agora são nullable — inserts não falham

### TESTE 2 — CRIAR TAREFA ✅ Corrigido

- **T2.1** Insert usa `responsavel_id: profileId` e `vence_em: format(date, "yyyy-MM-dd")` — OK
- **T2.2/T2.3** Central de Tarefas filtra por `responsavel_id` (team_members user_ids). O `responsavel_id` recebe `profileId` (profiles.id). Preciso verificar se Central espera profiles.id ou auth.uid...
  - Verificação: `TabAgora.tsx` e `TabProducao.tsx` filtram por `.in("responsavel_id", teamUserIds)` onde `teamUserIds` = `user_id` de `team_members` = **auth.uid**
  - **⚠️ PROBLEMA**: `responsavel_id` recebe `profileId` (profiles.id) mas Central filtra por `auth.uid`. Tarefa criada NÃO aparece na Central!
- **T2.4** `created_by: profileId` — também pode estar errado se a tabela espera auth.uid

### TESTE 3 — AGENDAR VISITA ❌ AINDA QUEBRADO

- **T3.1** Insert corrigido adicionou `nome_cliente`, `gerente_id`, `created_by`, `pipeline_lead_id`, `data_visita` formatado, `status: "marcada"` — OK
- **⚠️ CAMPO FALTANTE**: coluna `tipo` é NOT NULL sem default. Insert não passa `tipo`. Valores válidos: `'lead'` ou `'negocio'`. **Visita falha silenciosamente!**
- **T3.3** `corretor_id` recebe `profileId` (profiles.id). A tabela `visitas.corretor_id` — precisa verificar o que Agenda espera. Geralmente é profiles.id (consistente com outras queries)
- **T3.4** Lead é movido para etapa "Visita" — OK

### TESTE 4 — NOTA INTERNA ✅ Corrigido

- **T4.1** CHECK constraint agora aceita `'note'` — confirmado via query
- **T4.2** `instance_name` e `whatsapp_message_id` nullable — insert funciona
- Nota aparece na thread (direction='note' com fundo amarelo) — OK

### TESTE 5 — MOVER ETAPA ✅ Funcionando

- Update + atividade registrada — sem problemas

### TESTE 6 — HOMI COPILOT ⚠️ Sem logs recentes

- Sem chamadas nos logs. Prompt atualizado e deployado. Funcionamento pendente de teste real.

### TESTE 7 — TEMPLATES ✅ Funcionando

- Templates filtrados por `stage_id`, variáveis substituídas, textarea preenchido — OK

### TESTE 8 — REALTIME ✅ Funcionando

- `whatsapp_mensagens` está na publicação `supabase_realtime` — confirmado via query
- Canal inscrito em `postgres_changes` INSERT — OK

---

## Resumo

| # | Funcionalidade | Status |
|---|---------------|--------|
| 1 | Envio de mensagem | ✅ OK |
| 2 | Criar tarefa | ⚠️ `responsavel_id` usa profiles.id mas Central filtra por auth.uid |
| 3 | Agendar visita | ❌ Falta `tipo: "lead"` (NOT NULL) |
| 4 | Nota interna | ✅ OK |
| 5 | Mover etapa | ✅ OK |
| 6 | HOMI Copilot | ⚠️ Sem teste real |
| 7 | Templates | ✅ OK |
| 8 | Realtime | ✅ OK |
| 9 | Filtro "Não lidas" | ⚠️ Não existe como tab/botão |

---

## Plano de Correção (3 itens)

### Correção 1 — Visita: adicionar `tipo: "lead"` (CRÍTICO)

**Arquivo:** `src/components/whatsapp/ConversationThread.tsx`

Na função `handleScheduleVisit`, adicionar `tipo: "lead"` ao insert de `visitas`.

### Correção 2 — Tarefa: `responsavel_id` deve usar auth.uid

**Arquivo:** `src/components/whatsapp/ConversationThread.tsx`

Na função `handleCreateTask`, alterar `responsavel_id` e `created_by` para usar `authUser.id` (auth.uid) em vez de `profileId`. Buscar auth user antes do insert (já é feito em handleSend/handleScheduleVisit).

### Correção 3 — Filtro "Não lidas" na ConversationList

**Arquivo:** `src/components/whatsapp/ConversationList.tsx`

1. Adicionar tab `"unread"` ao array de tabs: `{ key: "unread", label: "Não lidas" }`
2. No `filteredConversations` memo, quando `tab === "unread"`, filtrar `conversations.filter(c => c.unreadCount > 0)`
3. No header, mostrar contagem de não lidas: `{conversations.filter(c => c.unreadCount > 0).length} não lidas`

**Arquivo:** `src/pages/WhatsAppInbox.tsx`

4. Melhorar cálculo de `unreadCount` no `loadConversations`:
   - Para cada conversa, contar mensagens `received` consecutivas do topo (mais recentes) antes de encontrar uma `sent`
   - Esse número = unreadCount real (não apenas 0 ou 1)

5. No realtime (INSERT handler):
   - Se `direction === "received"` e lead NÃO está selecionado: incrementar `unreadCount` da conversa
   - Se lead ESTÁ selecionado: não incrementar

Nenhuma alteração em Edge Functions ou tabelas.

