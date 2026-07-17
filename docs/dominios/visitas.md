# Domínio 7 — Visitas

## 1. Propósito
Registrar agendamento, confirmação, realização e no-show de visitas. É a ponte entre lead qualificado e negócio.

## 2. Tabelas
- `visitas` (42 col, 16 policies!) — colunas-chave:
  - Identidade: `id, corretor_id, gerente_id, pipeline_lead_id, negocio_id, lead_id, lead_site_id, linked_pdn_id`
  - Dados: `nome_cliente, telefone, empreendimento, data_visita, hora_visita, local_visita`
  - Status: `status ∈ {marcada, realizada, no_show}` (3 valores observados), `resultado_visita`
  - Confirmação pública: `confirmation_token uuid`, `token_expires_at`, `confirmed_at`, `cancel_reason`
  - Toques automáticos: `toque_marcacao_at, toque_d1_at, toque_d0_at, resposta_at, resposta_texto, risco_alertado_at`
  - Calendário: `google_event_id, google_event_link`
  - `tipo`, `tipo_reuniao`, `responsavel_visita`
- `visita_amanha_config`, `visita_amanha_disparos`
- `corretor_disponibilidade`, `corretor_calendar_integrations`
- `feriados`

### RLS (visitas — 16 policies!)
Combinações extensivas: corretor own/team, gestor team, admin all, diretor all, partner. Nível de granularidade acima da média.

### Achado 30d
```
visitas         841
com_motivo        0  ← cancel_reason nunca preenchido nos últimos 90d
distinct status   3  (marcada, realizada, no_show)
```

## 3. Fluxo
```
UI /agenda-visitas → INSERT visitas
    ↓
trg_visita_status_pipeline (AFTER INSERT/UPDATE)
    - marcada    → lead.stage = Visita
    - realizada  → lead.stage = Em Negociação + cria negocio
    - no_show    → lead.stage = Aquecimento + tarefa follow-up
    ↓
trg_lead_to_negocio_on_visita_realizada (AFTER UPDATE)
    - Cria row em negocios se ainda não existe
    ↓
trg_notify_visita_criada / trg_notify_visita_confirmada
    - Push notif + entrada notifications

Cron visita-whatsapp-confirm (D-1 e D-0):
    → whatsapp-send template → cliente confirma via botão
    → visita-public (endpoint sem auth) recebe confirmação
    → UPDATE confirmation via token
    → set confirmed_at, resposta_texto

calendar-create-event → Google Calendar (via corretor_calendar_integrations)
calendar-disconnect
google-oauth-start / google-oauth-callback
```

## 4. Componentes/hooks
- `src/components/visitas/VisitaResultadoDialog.tsx`, `VisitaRow.tsx`, `VisitasCobrancaDialog.tsx`
- `src/pages/VisitaConfirmacao.tsx` — endpoint público token-based
- `src/lib/visitaResultadoRouting.ts`
- Hooks: `useVisitas` (dentro de `useCorretorHomeData` etc.), `useCalendarIntegration`, `useVendaRealtimeNotification`

## 5. Edge Functions
| Fn | Faz |
|---|---|
| `visita-public` | Endpoint público token-based para confirmação (**verify_jwt=false, valida por token**) |
| `visita-whatsapp-confirm` | Cron dispara template WhatsApp de confirmação D-1/D-0 |
| `calendar-create-event` | Cria evento Google Calendar |
| `calendar-disconnect` | Remove integração |
| `google-oauth-start` / `google-oauth-callback` | OAuth Google |

## 6. Regras não óbvias
- **Confirmação via token público**: teve incidente de segurança (docs/security_backlog_27_maio_2026.md).
- **`trg_visita_status_pipeline`** move o lead automaticamente ao mudar `status` — é a única forma "oficial" de sair da etapa Visita.
- **`resultado_visita`** roteia o lead pós-visita (mem://features/pipeline/visita-resultado-routing) via `routeLeadAfterVisita`. Cada resultado incluindo "Continuar visitando" tem destino.
- **`no_show` NÃO captura motivo estruturado** — `cancel_reason` existe mas está sempre NULL. Não há dropdown/enum de motivo no schema.
- **`token_expires_at`** define quanto tempo o link público de confirmação é válido.
- Toques automáticos: `toque_marcacao_at` (na hora que marca), `toque_d1_at` (véspera), `toque_d0_at` (dia).

## 7. Decisões
- 16 policies em visitas — reflete gerência delicada de quem pode ver/editar (partner, gestor, admin, diretor, corretor own vs team).
- Confirmação via token público (não JWT) para permitir cliente confirmar sem app.
- Auto-move de stage por trigger em vez de app — reduz inconsistência.

## 8. Dependências
Consome: `pipeline-funil`, `imoveis-produto`, `admin-seguranca`. Produz para: `pipeline-funil` (transição de stage), `pos-venda-financeiro` (cria negocio).

## 9. Perguntas
1. **Motivo de no-show não é capturado** em lugar nenhum. Foi decisão de simplicidade ou esquecimento?
2. `cancel_reason` — 0 preenchidos em 90d. É campo morto?
3. Incidente de segurança do token público (backlog 27/mai) — foi resolvido? A rota `visita-public` continua com `verify_jwt=false`.
4. `lead_site_id` vs `pipeline_lead_id` vs `lead_id` — 3 FKs para lead na mesma tabela. Contexto?
5. `linked_pdn_id`, `converted_to_pdn_at`, `converted_to_pdn_by` — visita ligada a PDN do gestor. Usado?
6. `tipo` vs `tipo_reuniao` — dois campos parecidos.
7. `visita_amanha_config`/`disparos` vs `visita-whatsapp-confirm` — feature duplicada?
