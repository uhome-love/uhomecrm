

# Plano Revisado: Auto-Reply IA WhatsApp

## Correção aplicada

O `whatsapp-ai-reply` vai usar **o mesmo motor de IA que todas as funções HOMI já usam**: Lovable AI Gateway (`ai-helpers.ts`) com `google/gemini-2.5-flash`. Sem Anthropic, sem Claude — tudo centralizado no mesmo helper.

## O que será feito

### 1. Migração SQL
- Criar tabela `whatsapp_ai_log` (id, created_at, telefone, nome_contato, mensagem_recebida, tipo_mensagem, filtro_resultado, filtro_motivo, resposta_ia, lead_id, corretor_nome, status, erro_detalhe)
- RLS para authenticated + Realtime habilitado
- Adicionar coluna `ai_replied BOOLEAN DEFAULT FALSE` em `pipeline_leads`

### 2. Nova Edge Function: `whatsapp-ai-reply/index.ts`
- Usa `callAI` + `requireApiKey` de `_shared/ai-helpers.ts` (mesmo que homi-ana, homi-chat, etc.)
- Carrega empreendimentos via `_shared/enterprise-knowledge.ts`
- System prompt com persona HOMI: saudação personalizada, sem prometer tempo de resposta
- Envia resposta via Meta API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
- Insere em `whatsapp_ai_log` com `resposta_ia`
- Marca `ai_replied = true` no lead
- Registra na timeline (`pipeline_atividades`)
- Trata mídia (áudio/foto/doc): saudação padrão sem interpretar conteúdo

### 3. Modificar `whatsapp-webhook/index.ts`
- Em `handleUnknownReply`: após criar lead + distribuir, chamar `whatsapp-ai-reply` se `ai_replied = false` e sem janela 24h ativa
- Inserir em `whatsapp_ai_log` em todos os cenários (aprovado, erro, descartado)
- Em `handleExistingLeadReply`: NÃO chamar IA

### 4. Nova aba "Entradas WhatsApp" na Roleta
- Componente `WhatsAppEntradasTab.tsx` com Realtime
- Colunas: Horário, Contato, Mensagem, Filtro (badge), Resposta IA, Corretor, Status (badge)
- Filtros: dropdown Status + busca telefone/nome
- Últimos 100 registros, `created_at DESC`
- Adicionar tab em `RoletaLeads.tsx`

### 5. Nenhuma aba existente alterada

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | Migração SQL |
| Criar | `supabase/functions/whatsapp-ai-reply/index.ts` |
| Criar | `src/components/roleta/WhatsAppEntradasTab.tsx` |
| Modificar | `supabase/functions/whatsapp-webhook/index.ts` |
| Modificar | `src/pages/RoletaLeads.tsx` |

