# Domínio 11 — Marketing

## 1. Propósito
Ingestão e análise de campanhas de mídia paga (Meta Ads principalmente), campanhas de email/voz, e relatórios de marketing consolidados.

## 2. Tabelas
- `marketing_entries` (21 col) — entradas manuais/importadas de campanha
- `marketing_reports` (9 col)
- `campaign_clicks` (21 col) — clicks trackeados
- `meta_form_names, meta_number_quality, meta_supressao`
- `email_campaigns, email_campaign_recipients, email_events`
- `voice_campaigns, voice_call_logs`
- `melnick_campaign_analytics` — específico Melnick
- `conteudos_marketing` (13 col) — biblioteca de conteúdo
- `brevo_contacts` — importação Brevo

## 3. Fluxo
```
Meta Ads:
  Cron meta-ads-sync → Meta Marketing API → marketing_entries
  Webhook receive-meta-lead → pipeline_leads (com campanha_id, anuncio)
  meta_form_names traduz form_id → nome legível
  
Email Marketing:
  UI EmailMarketingPage → email_campaigns → email_campaign_recipients
  Cron mailgun-batch-cron → mailgun-send → Mailgun
  mailgun-webhook → email_events (delivered/opened/clicked/bounced)
  
Voz:
  UI CampanhasVoz → voice_campaigns
  voice-campaign-launcher → twilio-ai-call → ElevenLabs
  voice_call_logs registra resultado

Relatórios PDF:
  Upload PDF → parse-marketing-report (IA Vision) → marketing_reports
```

## 4. Componentes/hooks
- `src/pages/MarketingCentral.tsx`, `MarketingDashboard.tsx`, `EmailMarketingPage.tsx`, `CampanhasVoz.tsx`, `HomiAna.tsx`
- `src/components/marketing/*` (HomiIdeiasChat, MarketingAgendaTab, MetaAdsSettings)
- `src/components/email/*`, `src/components/relatorio/*`, `src/components/relatorios/*`
- Hooks: `useMarketing`, `useMetaAdsSync`, `useEmail`

## 5. Edge Functions
| Fn | Faz |
|---|---|
| `meta-ads-sync` | Sync Marketing API → marketing_entries |
| `parse-marketing-report` | Extrai KPIs de PDF |
| `mailgun-send`, `mailgun-batch-cron`, `mailgun-webhook` | Email |
| `voice-campaign-launcher` | Dispara campanha de voz |
| `twilio-ai-*`, `elevenlabs-webhook` | Voz IA |
| `meta-templates-list`, `meta-number-quality`, `resolve-meta-forms` | Metadata Meta |
| `homi-ana` | Assistente Marketing |

## 6. Regras não óbvias
- **Meta capture normalização**: mem://integracoes/data-normalization-rules-v3-marketing-capture — whitelist de campos.
- **`campanha_id`, `anuncio`, `conjunto_anuncio`, `plataforma`** em pipeline_leads permite attribution ponta-a-ponta.
- **Melnick Day**: legacy module removido, mas `melnick_campaign_analytics` + `melnick_metas_diarias` permanecem.

## 7. Decisões
- Meta como canal primário (74% dos leads em 30d).
- Backfill Meta (cron 1h) como rede de segurança contra webhook falho.

## 8. Dependências
Consome: nada. Produz: pipeline_leads (attribution), dashboards (KPIs).

## 9. Perguntas
1. `melnick_*` — Melnick é cliente/parceiro específico? Genericar?
2. `voice_campaigns` — volume atual? Voz IA está em uso?
3. `campaign_clicks` (21 col) — quantos por dia? Alimenta scoring?
4. `conteudos_marketing` — usado por `homi-ana`? Sync com Google Drive?
5. `brevo_contacts` — foi one-off ou sync contínuo?
6. `meta-ads-sync` roda em cron? Não vi entrada em `cron_health`.
