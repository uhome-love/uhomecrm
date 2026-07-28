
# Integração Meta CAPI (Conversions API)

Objetivo: quando um lead avança no CRM, o Meta recebe o evento correspondente (com email+telefone hasheados + `lead_id` do Meta quando existir) para otimizar campanhas e alimentar o Gerenciador de Eventos.

---

## 1. Antes de começar (Fase 0 — validação de credenciais)

Você disse que "acha" que já configurou. Vou:
1. Verificar em `integration_settings` se existe `meta_capi_dataset_id` e `meta_capi_access_token` — se sim, testo com uma chamada `POST /{dataset_id}/events?test_event_code=TEST123` (evento fake, não conta como conversão).
2. Se estiver faltando, peço via `add_secret` (`META_CAPI_DATASET_ID`, `META_CAPI_ACCESS_TOKEN`). O Dataset ID é o mesmo do Pixel (Gerenciador de Eventos → Configurações → ID do conjunto de dados). O token é gerado em "Gerar token de acesso".

Só sigo pras próximas fases depois de você confirmar o "OK conectado".

---

## 2. Mapa de eventos (o que dispara pro Meta)

| Estágio no CRM | event_name Meta | Dado extra |
|---|---|---|
| Entra em **Qualificação** | `Lead` | — |
| **Visita marcada** (visitas.status='marcada') | `Schedule` | data da visita |
| **Visita realizada** | `ViewContent` (`content_type=visita_realizada`) | empreendimento |
| Entra em **Em Negociação** | `SubmitApplication` | — |
| Entra em **Contrato** | `AddPaymentInfo` | — |
| **Ganho** (negocios.fase='ganho') | `Purchase` | `value` = VGV, `currency` = BRL |

Todos custom_data marcam `event_source: "crm"` e `lead_event_source: "uhome"` (exatamente como sua carga de referência).

---

## 3. Arquitetura

```text
pipeline_leads / negocios / visitas
        │  (trigger AFTER UPDATE)
        ▼
 meta_capi_queue  ── status: pending | sent | failed | skipped
        │
        │  cron 5min  +  trigger dispara edge fn imediato via pg_net
        ▼
 edge fn: meta-capi-dispatch
        │  batch 100 eventos → POST graph.facebook.com/v21.0/{dataset_id}/events
        ▼
   marca sent/failed + guarda fbtrace_id
```

**Dedup total**: cada evento tem `event_id = md5(lead_id||event_name||stage_entered_at)` — se o mesmo evento for enfileirado duas vezes (por trigger e backfill, ou por retry), o Meta descarta a duplicata. Zero risco de contar 2x.

---

## 4. Fases

### Fase 1 — Fundação (backend)
- Migration: cria `meta_capi_queue` (event_id PK, lead_id, event_name, event_time, payload jsonb, status, attempts, last_error, fbtrace_id, sent_at) + índices.
- Migration: função `enqueue_meta_capi_event(lead_id, event_name, event_time)` que monta o payload (hash SHA-256 de email/telefone, inclui `lead_id` do Meta quando `pipeline_leads.meta_lead_id` existir, adiciona `fbc`/`fbp` se disponíveis).
- Migration: triggers em `pipeline_leads` (stage_id change), `visitas` (status change), `negocios` (fase change) → chamam `enqueue_meta_capi_event`.
- Migration: `check_can_send_meta_capi(lead_id)` — só enfileira se lead tem origem Meta OU tem email/telefone válido (Meta não usa PII sem consentimento fora do escopo do ad, mas o match funciona com hash de qualquer forma).

### Fase 2 — Motor de envio
- Edge function `meta-capi-dispatch` (pública, HMAC/cron secret):
  - `claim` até 100 eventos `pending` (FOR UPDATE SKIP LOCKED).
  - POST batch pro Graph API v21.0.
  - Sucesso → `status='sent'`, salva `fbtrace_id`.
  - Falha → `attempts++`, retry até 5, depois `status='failed'`.
- Cron `*/5 * * * *` chama o dispatcher.
- Trigger no INSERT em `meta_capi_queue` dispara `pg_net` para o dispatcher (real-time, sem esperar 5min).

### Fase 3 — Backfill seguro
Análise: **backfill é seguro** por causa do `event_id` único. Zero duplicação.
- Meta usa eventos com `event_time` até **7 dias no passado** pra otimização de campanha.
- Eventos entre 7d e 90d ainda aparecem no Gerenciador de Eventos e alimentam analytics, mas não otimizam entrega.

Recomendação:
- **Backfill automático 7 dias** — ganho real de atribuição, sem risco.
- Backfill 90 dias opcional, só se você quiser o histórico completo no Gerenciador de Eventos (marco no relatório: "eventos históricos, sem impacto em otimização").

Script one-shot que enfileira todos os eventos elegíveis dos últimos 7d (executo depois que Fase 2 estiver validada com 10 eventos ao vivo).

### Fase 4 — UI de monitoramento
- Nova aba **"Meta CAPI"** em `/integracoes`:
  - Cards: eventos enviados 24h / falhas 24h / último envio / status conexão.
  - Tabela últimos 50 eventos (event_name, lead, status, fbtrace_id, erro).
  - Botão "Enviar evento de teste" (`test_event_code=TEST_UHOME`) que aparece no Gerenciador de Eventos → Test Events em 30s.
  - Botão "Rodar backfill 7d" (desabilitado até Fase 3 estar validada).

---

## 5. Validação de cada fase (regra fixa do fundador)

Cada fase termina com:
1. Diff revisado + printscreens do preview.
2. Teste ao vivo: você aciona (ex: mover um lead teste pra Qualificação) → confirmamos no Gerenciador de Eventos da Meta em **Test Events** (usando `test_event_code`) antes de habilitar em produção.
3. Só depois libero a próxima fase.

Nada dispara pra Meta produção sem que Test Events valide primeiro.

---

## 6. Detalhes técnicos (para referência)

- Endpoint: `POST https://graph.facebook.com/v21.0/{DATASET_ID}/events`
- Auth: `?access_token={TOKEN}` (server-side, nunca frontend)
- Hash: SHA-256 lowercase trim de email; telefone só dígitos com DDI (55…) antes do hash
- Campos user_data: `em`, `ph`, `lead_id` (numérico do Meta, quando origem for ad Meta), `fbc` (`fb.1.{timestamp}.{fbclid}`), `fbp`, `client_ip_address`, `client_user_agent` (só se capturados no site)
- `action_source`: `"system_generated"` (bate com sua carga de referência)
- Retry backoff exponencial: 1min, 5min, 15min, 1h, 6h
- Rate limit Meta: 100k eventos/hora por dataset — muito acima do nosso volume

---

## 7. O que NÃO faço nessa entrega
- Não mexo em nenhum edge function existente (`receive-meta-lead`, `meta-ads-sync`, etc.).
- Não altero nenhuma tela do pipeline nem trigger de negócio existente.
- Não envio dados sem hash.
- Não crio nada que não passe pelo Test Events antes de ir pra produção.

Pronto pra começar pela **Fase 0** (checar credenciais) assim que você aprovar o plano.
