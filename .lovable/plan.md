

## Diagnóstico Completo — WhatsApp Inbox

---

### BLOCO 1 — ENVIO DE MENSAGEM ❌ QUEBRADO (2 problemas críticos)

**Problema 1.A: Insert em `whatsapp_mensagens` falha por colunas NOT NULL**

Após o `whatsapp-send` retornar sucesso, o frontend insere na tabela `whatsapp_mensagens` (linha 260-266):

```typescript
await supabase.from("whatsapp_mensagens").insert({
  lead_id: leadId,
  corretor_id: profileId,
  direction: "sent",
  body: text.trim(),
  timestamp: new Date().toISOString(),
});
```

A tabela `whatsapp_mensagens` tem **duas colunas NOT NULL sem default** que NÃO estão sendo preenchidas:
- `instance_name` (text, NOT NULL) — **falta no insert**
- `whatsapp_message_id` (text, NOT NULL) — **falta no insert**

Isso causa um erro de constraint violation que é capturado pelo catch e exibe toast genérico, mas a mensagem já foi enviada via Meta API (não é revertida). O usuário vê erro mas a mensagem saiu.

**Problema 1.B: Edge Function usa apenas Meta API**

A `whatsapp-send` envia exclusivamente pela Meta Business API (`graph.facebook.com`). Não usa Evolution API. Para corretores com instância Evolution (como Ebert), a mensagem sai pelo número da empresa e não pelo número pessoal.

**Correção necessária:**
1. No insert de `whatsapp_mensagens` após envio: preencher `instance_name` (buscar da instância do corretor ou usar `"meta"`) e `whatsapp_message_id` (usar o `message_id` retornado pela Meta API ou gerar UUID)
2. Capturar `sendResult.message_id` e usar no insert

---

### BLOCO 2 — CRIAR TAREFA ⚠️ PARCIALMENTE QUEBRADO

O insert (linha 345-354):
```typescript
await supabase.from("pipeline_tarefas").insert({
  pipeline_lead_id: leadId,
  titulo: taskTitle.trim(),
  tipo: taskType,
  descricao: taskDescription.trim() || null,
  prioridade: taskPriority,
  status: "pendente",
  vence_em: getDeadline(taskDeadline, taskCustomDate).toISOString(),
  created_by: profileId,
});
```

**Problema 2.A: `vence_em` é tipo DATE, mas recebe ISO timestamp**

A coluna `vence_em` é `date` (não `timestamp`). O `getDeadline()` retorna `.toISOString()` que gera `"2026-04-16T13:00:00.000Z"`. Supabase pode aceitar isso (truncando para date), mas é arriscado.

**Problema 2.B: `created_by` recebe `profileId` (profiles.id)**

A coluna `created_by` é `uuid NOT NULL`. O `profileId` vem de `profiles.id`. Preciso verificar se RLS policies e a Central de Tarefas filtram por `created_by` ou `responsavel_id`. O campo `responsavel_id` **não está sendo preenchido** — a tarefa pode ficar "órfã" sem responsável atribuído.

**Correção necessária:**
1. Converter `vence_em` para formato date: `format(getDeadline(...), "yyyy-MM-dd")`
2. Preencher `responsavel_id` com `profileId` para que apareça na Central de Tarefas

---

### BLOCO 3 — AGENDAR VISITA ❌ QUEBRADO

O insert (linha 305-311):
```typescript
await supabase.from("visitas").insert({
  lead_id: leadId,
  corretor_id: profileId,
  data_visita: dt.toISOString(),   // ← PROBLEMA
  empreendimento: visitLocal || leadInfo.empreendimento,
  status: "agendada",              // ← PROBLEMA
});
```

**Problemas encontrados:**

| Campo | Esperado pela tabela | Enviado | Status |
|-------|---------------------|---------|--------|
| `nome_cliente` | NOT NULL | **NÃO ENVIADO** | ❌ CRASH |
| `gerente_id` | NOT NULL | **NÃO ENVIADO** | ❌ CRASH |
| `created_by` | NOT NULL | **NÃO ENVIADO** | ❌ CRASH |
| `data_visita` | DATE | ISO timestamp | ⚠️ Pode falhar |
| `status` | default 'marcada' | 'agendada' | ⚠️ Pode divergir |
| `corretor_id` | uuid | profileId | ✅ OK |
| `origem` | default 'manual' | não enviado | ✅ OK (usa default) |

A visita **falha silenciosamente** porque faltam 3 campos NOT NULL: `nome_cliente`, `gerente_id`, `created_by`.

**Correção necessária:**
```typescript
await supabase.from("visitas").insert({
  pipeline_lead_id: leadId,
  lead_id: leadId,
  nome_cliente: leadInfo.nome,
  corretor_id: profileId,
  gerente_id: authUser.id, // ou buscar do team_members
  created_by: authUser.id,
  data_visita: format(dt, "yyyy-MM-dd"),
  hora_visita: visitTime,
  empreendimento: visitLocal || leadInfo.empreendimento || "",
  status: "marcada",
  origem: "pipeline",
});
```

---

### BLOCO 4 — MOVER ETAPA ✅ FUNCIONANDO

O `handleMoveStage` (linha 367-388) faz update correto de `stage_id` e registra atividade em `pipeline_atividades`. Sem problemas identificados.

---

### BLOCO 5 — NOTA INTERNA ❌ QUEBRADO

**Problema:** A tabela `whatsapp_mensagens` tem um CHECK constraint:
```sql
CHECK (direction = ANY (ARRAY['sent', 'received']))
```

O insert de nota usa `direction: "note"` (linha 244), que **viola o CHECK constraint**. Além disso, `instance_name` e `whatsapp_message_id` (NOT NULL) não são preenchidos.

**Correção necessária:**
- Alterar o CHECK constraint para incluir `'note'` (migration)
- OU usar uma tabela separada para notas (ex: `pipeline_atividades` com tipo "nota")
- Preencher `instance_name` e `whatsapp_message_id` com valores sentinela

---

### BLOCO 6 — HOMI COPILOT ⚠️ NÃO TESTADO EM PRODUÇÃO

Os logs mostram apenas boots, sem erros nem chamadas reais recentes. A lógica no código parece correta — passa histórico de mensagens sent+received e dados do lead.

---

## Resumo de Prioridade

| # | Bloco | Status | Impacto |
|---|-------|--------|---------|
| 1 | Nota Interna | ❌ CHECK constraint rejeita 'note' | **Migration necessária** |
| 2 | Envio de Mensagem | ❌ Insert falta `instance_name` e `whatsapp_message_id` | **Crítico** |
| 3 | Agendar Visita | ❌ Falta 3 campos NOT NULL | **Crítico** |
| 4 | Criar Tarefa | ⚠️ Falta `responsavel_id`, formato date | **Médio** |
| 5 | Mover Etapa | ✅ OK | — |
| 6 | HOMI Copilot | ⚠️ Sem dados de teste | **Baixo** |

## Plano de Correção (ordem)

**Passo 1 — Migration:** Alterar CHECK constraint de `whatsapp_mensagens.direction` para aceitar `'note'`. Adicionar defaults ou tornar nullable: `instance_name` e `whatsapp_message_id`.

**Passo 2 — `ConversationThread.tsx`:** Corrigir os 3 inserts:
- Insert de mensagem sent: adicionar `instance_name: "meta"`, `whatsapp_message_id: sendResult?.message_id || crypto.randomUUID()`
- Insert de nota: adicionar `instance_name: "internal"`, `whatsapp_message_id: crypto.randomUUID()`
- Insert de visita: adicionar `nome_cliente`, `gerente_id`, `created_by`, formatar `data_visita` como date, usar status `"marcada"`
- Insert de tarefa: adicionar `responsavel_id: profileId`, formatar `vence_em` como date string

**Passo 3 — Build e teste.**

