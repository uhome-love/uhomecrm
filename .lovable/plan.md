

## Duas Camadas Separadas: Automações (CEO) + Sistema Proativo (Corretor)

### Esclarecimento de Conceitos

| Conceito | Quem controla | O que faz |
|---|---|---|
| **Automações** | CEO (admin only) | Dispara WhatsApp/email em massa por etapa, para TODOS os leads automaticamente. Ex: todo lead em "Sem Contato" há 2 dias recebe mensagem. Sistema roda sozinho. |
| **Sistema Proativo (StageCoach)** | Corretor (individual) | Ao abrir um lead, mostra sugestões de ação, mensagens prontas, scripts adaptados à etapa. O corretor decide o que usar. É um assistente, não uma automação. |

### Implementação — Fase 1: Sistema Proativo (StageCoachBar)

**Novo: `src/components/pipeline/StageCoachBar.tsx`**

Componente inserido entre o header (Row 5) e as Tabs (linha 507) do `PipelineLeadDetail.tsx`. Recebe `currentStage.tipo`, dados do lead e callbacks.

Comportamento por etapa:

- **Sem Contato**: Diagnóstico "Lead há X dias sem contato" + botões "Script de ligação", "WhatsApp apresentação", mensagem pronta de boas-vindas
- **Contato Iniciado**: "Conexão iniciada" + "Perguntas iniciais", "Follow-up conexão", mensagem de primeiro contato
- **Qualificação**: "Hora de entender o perfil" + "Gerar Vitrine IA", "Perguntas de perfil", mensagem com perguntas de qualificação
- **Possível Visita**: "Lead aquecido" + "Follow-up visita", "Destaques do imóvel", mensagem para agendar
- **Visita Marcada**: "Confirmar visita" + "Lembrete ao cliente", "Reforçar importância"
- **Visita Realizada**: "Momento crucial" + "Agradecer visita", "Enviar simulação"
- **Negociação**: "Lead quente" + "Follow-up proposta", "Condições especiais"

Cada ação: copiar mensagem pronta (com `{{nome}}`, `{{empreendimento}}`), criar tarefa com 1 clique, ou chamar HOMI para personalizar.

Visual: barra compacta com fundo sutil, ícone de lâmpada, 1 linha de diagnóstico + 2-3 botões de ação + mensagem expansível.

**Alteração: `src/components/pipeline/PipelineLeadDetail.tsx`**
- Importar e inserir `<StageCoachBar>` entre Row 5 e as Tabs (linha ~506)
- Passar: `stageTipo`, `leadNome`, `empreendimento`, `diasSemContato`, `tentativasLigacao`, `addTarefa`, `reload`

### Implementação — Fase 2: Automações em Massa (CEO only)

**Alteração: `src/App.tsx`**
- Restringir rota `/automacoes` de `["gestor", "admin"]` para `["admin"]` only

**Migração SQL: tabela `lead_nurturing_sequences`**
```
id, pipeline_lead_id, stage_tipo, step_key, canal, 
template_name, scheduled_at, sent_at, status, 
error_message, created_at
```
- Índice único em `(pipeline_lead_id, step_key)` para evitar duplicidade
- RLS: acesso apenas via service_role (edge functions)

**Trigger SQL: auto-criação de sequência na mudança de etapa**
- Quando `pipeline_leads.stage_id` muda, cancelar steps pendentes da etapa anterior e inserir os novos steps da nova etapa com `scheduled_at` calculado (D0, D2, D5, etc.)

**Nova Edge Function: `cron-nurturing-sequencer/index.ts`**
- Roda a cada 30 min via pg_cron
- Busca `lead_nurturing_sequences` onde `scheduled_at <= now()` e `status = 'pendente'`
- Dispara WhatsApp via Meta API usando templates aprovados
- **Obrigatório**: Insere registro em `pipeline_atividades` para CADA disparo:
  ```
  tipo: "nurturing_sequencia"
  titulo: "📨 Follow-up automático: [nome do step]"
  pipeline_lead_id: [id]
  status: "concluida"
  ```
- O corretor vê toda interação automática na timeline do lead

**Alteração: `src/pages/AutomacoesPage.tsx`**
- Nova seção "Sequências de Nutrição" com:
  - Dashboard: leads ativos por etapa, disparos últimas 24h
  - Toggle global para pausar/ativar todas as sequências
  - Log centralizado de todos os disparos

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/pipeline/StageCoachBar.tsx` | **NOVO** — coach proativo por etapa para corretor |
| `src/components/pipeline/PipelineLeadDetail.tsx` | Inserir StageCoachBar entre header e tabs |
| `src/App.tsx` | Restringir `/automacoes` para `["admin"]` |
| `src/pages/AutomacoesPage.tsx` | Seção "Sequências de Nutrição" (dashboard CEO) |
| `supabase/functions/cron-nurturing-sequencer/index.ts` | **NOVO** — processador de sequências com log em `pipeline_atividades` |
| Migração SQL | Tabela `lead_nurturing_sequences` + trigger de mudança de etapa |

### Garantias
- Corretor vê o coach + histórico de interações automáticas, mas NÃO controla automações
- CEO controla tudo em `/automacoes` (somente admin)
- 100% das interações automáticas ficam no histórico do lead
- Nenhuma edge function existente é alterada

