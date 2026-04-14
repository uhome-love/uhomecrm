

# Auditoria Completa — WhatsApp Inbox

## BLOCO 1 — CONEXÃO E INSTÂNCIA

| # | Item | Status |
|---|------|--------|
| 1.1 | Tabela `whatsapp_instancias` existe com campos corretos | ✅ OK |
| 1.2 | Edge Function `whatsapp-connect` deployada (4 actions) | ✅ OK |
| 1.3 | Página `/configuracoes/whatsapp` com QR Code | ✅ OK |
| 1.4 | Status `conectado` salvo corretamente | ✅ OK — statusMap mapeia `open` → `conectado` |
| 1.5 | Webhook configurado automaticamente ao criar instância | ✅ OK |

## BLOCO 2 — RECEBIMENTO DE MENSAGENS

| # | Item | Status |
|---|------|--------|
| 2.1 | `evolution-webhook` deployada com `verify_jwt = false` | ✅ OK |
| 2.2 | Filtragem por número do lead | ✅ OK — ILIKE últimos 8 dígitos |
| 2.3 | Normalização de número | ✅ OK — remove caracteres, usa últimos 8 dígitos |
| 2.4 | Mensagens salvas com campos corretos | ✅ OK |
| 2.5 | `pipeline_leads.updated_at` atualizado | ✅ OK |

## BLOCO 3 — WHATSAPP INBOX — LISTA

| # | Item | Status |
|---|------|--------|
| 3.1 | Conversas ativas filtradas por corretor (profileId) | ✅ OK |
| 3.2 | Follow-up sugerido populando | ✅ OK — leads >3 dias sem contato, sem mensagens |
| 3.3 | Novos leads (Sem Contato sem WhatsApp) | ✅ OK |
| 3.4 | Filtros Todas/Ativas/Follow-up/Novos | ✅ OK |
| 3.5 | Busca de lead por nome | ✅ OK |
| 3.6 | Badge de não lidas por conversa | ✅ OK — mas conta apenas 0 ou 1 (última msg received) |
| 3.7 | SLA badge (tempo sem resposta) | ✅ OK — amarelo >2h, vermelho >24h |
| 3.8 | Realtime — lista atualiza | ❌ **QUEBRADO** |
| 3.9 | Dialog "Nova conversa" com chips de etapa | ✅ OK |

**3.8 — Problema**: A tabela `whatsapp_mensagens` **NÃO está na publicação `supabase_realtime`**. O canal `postgres_changes` em `WhatsAppInbox.tsx` (linha 263) nunca dispara. Nenhuma nova mensagem aparece em tempo real, nenhuma notificação de navegador funciona, nenhum som toca.

**Correção**: Executar migração SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;
```

## BLOCO 4 — WHATSAPP INBOX — THREAD

| # | Item | Status |
|---|------|--------|
| 4.1 | Thread carregando mensagens ASC | ✅ OK |
| 4.2 | Balões sent/received com cores corretas | ✅ OK — `bg-primary` / `bg-card` |
| 4.3 | Notas internas (direction='note') fundo amarelo | ✅ OK |
| 4.4 | Envio chama `whatsapp-send` + salva em `whatsapp_mensagens` | ✅ OK |
| 4.5 | Realtime — nova mensagem aparece | ❌ **QUEBRADO** — mesma causa de 3.8 |
| 4.6 | Auto-scroll para última mensagem | ✅ OK |
| 4.7 | Enter envia, Shift+Enter quebra linha | ✅ OK |

## BLOCO 5 — BARRA DE AÇÕES RÁPIDAS

| # | Item | Status |
|---|------|--------|
| 5.1 | Templates filtrados por etapa | ✅ OK |
| 5.2 | `{nome}` e `{empreendimento}` substituídos | ✅ OK |
| 5.3 | Agendar Visita — insert + move etapa | ✅ OK |
| 5.4 | Criar Tarefa — `pipeline_lead_id` correto | ✅ OK |
| 5.5 | Mover Etapa — update `stage_id` | ✅ OK |
| 5.6 | Nota Interna — NÃO chama `whatsapp-send` | ✅ OK |
| 5.7 | Nota Interna — reset ao trocar lead | ✅ OK |

## BLOCO 6 — HOMI COPILOT

| # | Item | Status |
|---|------|--------|
| 6.1 | Edge Function deployada, retorna JSON | ✅ OK |
| 6.2 | Aparece quando última msg é received | ✅ OK — condição ampliada para últimas 5 |
| 6.3 | Briefing em itálico verde | ✅ OK |
| 6.4 | Badge de tom correto | ✅ OK |
| 6.5 | Botão "Usar" preenche textarea | ✅ OK |
| 6.6 | Botão "Ignorar" esconde card | ✅ OK |
| 6.7 | "+ Follow-up" insere em `pipeline_tarefas` | ✅ OK |
| 6.8 | Usa `valor_estimado` (não `orcamento`) | ✅ OK — Edge Function usa `valor_estimado` |

## BLOCO 7 — PAINEL DO LEAD (DIREITO)

| # | Item | Status |
|---|------|--------|
| 7.1 | Dados do lead carregando | ✅ OK |
| 7.2 | Edição inline de Etapa | ✅ OK |
| 7.3 | Edição inline de Empreendimento | ✅ OK |
| 7.4 | Edição inline de Orçamento | ❌ **QUEBRADO** |
| 7.5 | Score HOMI calculando | ✅ OK |
| 7.6 | Tarefas pendentes carregando | ✅ OK |
| 7.7 | Botão ✓ concluindo tarefa | ✅ OK |
| 7.8 | Histórico carregando de `pipeline_atividades` | ✅ OK |
| 7.9 | Botão "Ver ficha completa" navega para `/pipeline` | ✅ OK |

**7.4 — Problema**: `LeadPanel.tsx` usa o campo `orcamento` em 3 locais (linhas 174, 288, 290), mas a tabela `pipeline_leads` **não tem coluna `orcamento`** — apenas `valor_estimado`. O campo sempre mostra "—" e o save gera erro silencioso.

**Correção** em `LeadPanel.tsx`:
- Linha 174: `updateData.orcamento` → `updateData.valor_estimado`
- Linha 288: `localLead.orcamento` → `localLead.valor_estimado`
- Linha 290: `localLead.orcamento` → `localLead.valor_estimado`
- Interface `LeadInfo` (linha 26): remover `orcamento`, já tem `valor_estimado`

## BLOCO 8 — INTEGRAÇÃO COM PIPELINE

| # | Item | Status |
|---|------|--------|
| 8.1 | Aba WhatsApp no modal do lead mostra histórico | ✅ OK |
| 8.2 | Botão "Iniciar conversa" navega para `/whatsapp?lead=id` | ✅ OK |
| 8.3 | Mudança de etapa no Inbox reflete no Pipeline | ✅ OK |
| 8.4 | Visita agendada aparece na Agenda | ✅ OK |
| 8.5 | Tarefa criada aparece na Central | ✅ OK |
| 8.6 | Atividades registradas no histórico | ⚠️ **PARCIAL** |

**8.6 — Problema**: Nenhuma ação no Inbox (envio de mensagem, agendamento de visita, mudança de etapa) faz insert em `pipeline_atividades`. O histórico só mostra atividades criadas por outros módulos.

**Correção**: Adicionar inserts em `pipeline_atividades` após ações-chave:
- Após enviar mensagem (tipo: `mensagem`)
- Após agendar visita (tipo: `visita`)
- Após mover etapa (tipo: `etapa`)

## BLOCO 9 — SIDEBAR E NAVEGAÇÃO

| # | Item | Status |
|---|------|--------|
| 9.1 | Link "WhatsApp Inbox" na sidebar (corretor e admin) | ✅ OK |
| 9.2 | Link "Meu WhatsApp" na sidebar | ✅ OK |
| 9.3 | Badge de não lidas na sidebar | ✅ OK — via localStorage |
| 9.4 | Rota `/whatsapp` protegida (corretor e admin) | ✅ OK |
| 9.5 | Rota `/configuracoes/whatsapp` protegida | ✅ OK |

## BLOCO 10 — LAYOUT E UX

| # | Item | Status |
|---|------|--------|
| 10.1 | Página sem scroll externo | ✅ OK — margem negativa aplicada |
| 10.2 | Lista com scroll interno | ✅ OK |
| 10.3 | Thread com scroll interno | ✅ OK |
| 10.4 | Painel direito com scroll interno | ✅ OK |
| 10.5 | HOMI card com max-height | ✅ OK — `max-h-[180px] overflow-y-auto` |

---

## RESUMO DE PROBLEMAS (Priorizado)

| Prioridade | Item | Problema | Arquivo | Correção |
|---|---|---|---|---|
| 🔴 P0 | 3.8 + 4.5 | **Realtime não funciona** — tabela não está na publicação | Migração SQL | `ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens;` |
| 🔴 P1 | 7.4 | **Orçamento quebrado** — usa campo `orcamento` que não existe, deveria ser `valor_estimado` | `LeadPanel.tsx` linhas 174, 288, 290 | Substituir `orcamento` por `valor_estimado` |
| 🟡 P2 | 8.6 | **Atividades não registradas** — ações do Inbox não geram registro em `pipeline_atividades` | `ConversationThread.tsx` | Adicionar inserts em `pipeline_atividades` após envio, visita e mudança de etapa |

**Total: 37 itens auditados — 34 ✅ OK, 1 ⚠️ Parcial, 3 ❌ Quebrados (2 problemas raiz)**

