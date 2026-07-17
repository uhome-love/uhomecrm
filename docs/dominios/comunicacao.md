# Domínio 3 — Comunicação (WhatsApp + Email)

> **Estado atual:** WhatsApp em modo restrito por causa de qualidade Meta 13/07/2026; Email (Mailgun) 100% funcional; Evolution API com 12 de 18 instâncias desconectadas (RAIO-X).

---

## 1. Propósito de negócio

Enviar e receber mensagens transacionais e de nutrição pelos canais WhatsApp (via Evolution API self-hosted, Meta Cloud API 360dialog, e WABA direto) e Email (Mailgun), com histórico ligado ao `pipeline_lead`, respeitando janela 24h da Meta, opt-outs e rate limits.

---

## 2. Tabelas envolvidas

### WhatsApp
- `whatsapp_instancias` — 7 col, 5 policies. Uma por corretor: `nome_instancia = uhome-{brokerSlug}`.
- `whatsapp_mensagens` — 13 col, 5 policies. `direction ∈ {in,out,note}` (mem://features/whatsapp/thread-acoes-e-notas).
- `whatsapp_respostas` — respostas inbound (10 col, 1 policy).
- `whatsapp_ai_log` — log de invocações de IA (13 col).
- `whatsapp_campaign_batches`, `whatsapp_campaign_sends` — campanhas.
- `waba_send_guards` — anti-spam guard (janela + throttle).
- `blocked_templates` — templates bloqueados pela Meta.
- `meta_supressao` — números opt-out/bloqueados (autoatualiza por webhook Meta 131049).
- `meta_form_names`, `meta_number_quality` — metadata.
- `campanha_atrio_*` — 5 tabelas de uma campanha específica (ativa? — flag `campanha_atrio_enabled=false` em system_flags).

### Email
- `email_campaigns`, `email_campaign_recipients`
- `email_templates`, `email_settings`
- `email_events` (delivered/opened/clicked/bounced via Mailgun webhook)
- `email_suppression_list`

### Templates e histórico
- `comunicacao_templates`, `comunicacao_historico`
- `nurturing_cadencias` (usa templates).

### RLS
- `whatsapp_mensagens`: **apenas leads em `pipeline_leads` são logados** — mem://features/whatsapp/privacy-and-filtering-rules.
- Corretor vê msgs do próprio lead; gestor da equipe; admin tudo.

---

## 3. Fluxo de dados ponta a ponta

### WhatsApp Outbound (self-hosted Evolution)
```
UI (WhatsAppLanding, HomiCopilotCard)
   │
   ▼
supabase.functions.invoke('whatsapp-send' | 'whatsapp-send-media')
   │
   ├─ Checa system_flags.campaign_dispatch_enabled
   ├─ Checa meta_supressao
   ├─ Checa waba_send_guards (rate limit 250/dia, delay 3-6s, batch 30)
   ├─ Se dentro da janela 24h → texto livre
   │  Senão → template Meta aprovado
   ▼
Evolution API `POST /message/sendText/{instancia}` OU 360dialog
   │
   ▼
INSERT whatsapp_mensagens (direction=out)
INSERT pipeline_atividades (tipo=whatsapp)
```

### WhatsApp Inbound
```
Evolution/360dialog webhook → evolution-webhook  (função PÚBLICA sem auth — flag no RAIO-X)
                            → whatsapp-360dialog
                            → whatsapp-webhook
   │
   ▼
Match telefone (últimos 8 dígitos ILIKE) → pipeline_leads
   │
   ├─ set pipeline_leads.conversation_window_until = now()+24h
   ├─ INSERT whatsapp_mensagens (direction=in)
   ├─ Se AI reply habilitada e ai_replied=false:
   │     → whatsapp-ai-reply (Gemini) responde qualificação
   │       (mem://features/whatsapp/ai-auto-reply-and-monitoring)
   └─ nurturing-orchestrator recebe evento `whatsapp_respondeu` (+15 score)
```

### Email
```
UI EmailMarketingPage / Cron
   │
   ▼
mailgun-batch-cron (FOR UPDATE SKIP LOCKED em email_campaign_recipients)
   │
   ▼
mailgun-send → Mailgun REST API
   │
   ▼
Mailgun webhook → mailgun-webhook → INSERT email_events
```

---

## 4. Componentes e hooks

**WhatsApp**
- `src/pages/WhatsAppLanding.tsx` — inbox
- `src/components/whatsapp/*` — LeadPanel, HomiCopilotCard, MediaRenderer, CorretorSelector
- `src/hooks/useWhatsAppCampaign.ts`, `useWhatsAppNotifications.ts`, `useComunicacao.ts`
- `src/components/central-nutricao/`, `src/components/comunicacao/CentralComunicacao.tsx`

**Email**
- `src/pages/EmailMarketingPage.tsx`, `ImportBrevoContacts.tsx`
- `src/components/email/EmailSettingsTab.tsx`, `EmailTemplatesTab.tsx`

**Templates**
- `src/pages/TemplatesComunicacao.tsx`

---

## 5. Edge Functions

| Function | Faz |
|---|---|
| `whatsapp-send` | Envia texto por Evolution |
| `whatsapp-send-media` | Envia mídia |
| `whatsapp-connect` | Conecta/QR code de nova instância Evolution |
| `whatsapp-webhook` | Recebe eventos genéricos |
| `whatsapp-360dialog` | Envio via 360dialog (Meta Cloud API) |
| `evolution-webhook` | Recebe do Evolution API — **PÚBLICO sem auth** (achado de segurança) |
| `whatsapp-ai-reply` | Auto-reply IA para qualificação |
| `whatsapp-notificacao` | Notificações internas (SLA, novas msgs) |
| `whatsapp-profile-picture` | Baixa avatar |
| `whatsapp-campaign-dispatch` | Dispara campanha em lote |
| `mailgun-send` | Envia 1 email |
| `mailgun-batch-cron` | Cron que processa fila de envios |
| `mailgun-webhook` | Recebe eventos Mailgun |
| `meta-templates-list` | Lista templates aprovados na Meta |
| `meta-number-quality` | Consulta health do número Meta |
| `campanha-atrio-*` (5 funções) | Campanha específica; **desativada** (`campanha_atrio_enabled=false`) |

---

## 6. Regras não óbvias

- **Janela 24h Meta**: `pipeline_leads.conversation_window_until` é setada quando lead responde; enquanto ativa, dá para mandar texto livre; expirada, só template pré-aprovado.
- **Cap 250 msgs/dia por instância, delay 3-6s, batch 30** (mem://features/whatsapp/rate-limiting-anti-spam).
- **`meta_supressao` autoatualiza** a partir dos erros Meta 131049 (número bloqueou empresa).
- **Match de telefone**: normaliza para últimos 8 dígitos e faz `ILIKE %XXXXXXXX%` — evita mismatch por DDI/DDD.
- **`direction='note'`** em `whatsapp_mensagens` é nota interna do corretor, não vai para o cliente.
- **HOMI Copilot**: analisa últimas 15 mensagens (mem://ai/homi-copilot-automacao) para gerar sugestão. Gemini 2.0 Flash.
- **KILL SWITCH em `system_flags.campaign_dispatch_enabled`** — hoje `true` desde 13/07 mas motor de disparo em massa desligado na fonte (mem://features/whatsapp/reengajamento-parado-spam-meta).
- **`system_flags.nutricao_enabled=false`** — nutrição desligada, só liga manualmente.
- **`campanha_atrio_enabled=false`** — kill switch manual.

---

## 7. Decisões de design

- **`Runtime Direto Único v5`**: cliente Supabase plain (sem fetch wrappers) — removeu 8 camadas de "resiliência" que travavam Wi-Fi (mem://bugs/wifi-fetch-wrappers-13mai2026).
- **`Meta entrega/qualidade`**: media handle + supressão automática + auto-pausa por taxa de entrega contra throttle 131049 (mem://features/whatsapp/meta-entrega-qualidade).
- **`Reengajamento parado por spam Meta 13/07`**: 3 travas em série (system_flags + reengajamento_config + fila cancelada) — não reativar sem qualidade/base quente.
- **`Nutrição manual only`**: gate único `system_flags.campaign_dispatch_enabled` (default false), crons inativos — só usuário libera.

---

## 8. Dependências

**Consome de:**
- `pipeline-funil` (só logo se tem pipeline_lead)
- `admin-seguranca` (RLS)
- `homi-ia` (respostas automáticas e sugestões)

**Produz para:**
- `nutricao-reengajamento` (eventos alimentam scoring)
- `pipeline-funil` (`conversation_window_until`, atividades)

---

## 9. Perguntas em aberto

1. **WhatsApp foi descontinuado como canal geral?** O código não tem feature flag por canal — o "descontinuar" foi só apagar automações + `nutricao_enabled=false` + orientação humana? Não há remoção de código nem flag específica dizendo "whatsapp_deprecated".
2. `evolution-webhook` **público sem auth** — é vulnerabilidade a corrigir ou dependência de Evolution não permite JWT? (RAIO-X aponta como crítico.)
3. 12 de 18 instâncias Evolution desconectadas — decisão de negócio (corretor saiu, não reconectou) ou dívida operacional?
4. Existem 3 clientes WhatsApp: Evolution self-hosted, 360dialog, WABA direto. Qual é a estratégia oficial 2026?
5. `campanha_atrio_*` — 5 tabelas + 5 funções desativadas. Deletar ou vai reativar?
6. Auto-reply IA (`whatsapp-ai-reply`): quem controla se está ligado por corretor? Não achei toggle claro.
7. `whatsapp_ai_log` tem 1 policy só (leitura) — pra quem?
