# Domínio 4 — Nutrição e Reengajamento

> **Estado atual: PAUSADO.** 3 travas em série impedem disparo automático. Central de Reengajamento (/central-nutricao) é 100% manual.

---

## 1. Propósito de negócio

Manter leads "quentes" com toques automáticos (email/WhatsApp/voz) em cadências pré-definidas, e reengajar leads descartados que possam voltar a ficar aquecidos. Aplicar scoring event-driven que reclassifica temperatura e notifica corretor quando lead esquenta.

---

## 2. Tabelas envolvidas

### Estado por lead
- `lead_nurturing_state` (15 col, 2 policies): `pipeline_lead_id, lead_score, sequencia_ativa, status ∈ {ativo,pausado,respondeu,converteu,opt_out}, tentativas_contato, tentativas_voz, ultimo_evento, ultimo_evento_at, canal_ultimo`.
- `lead_nurturing_sequences` (14 col): passos programados. `status ∈ {pendente,enviado,cancelado}`.
- `nurturing_cadencias`: templates de cadência (10 col).

### Sem-contato cadence
- `cadencia_sem_contato_passos` (9 col)
- `lead_cadencia_sem_contato` (11 col)

### Reengajamento (descartados)
- `reengajamento_config` (36 col) — parâmetros de cada onda
- `reengajamento_dispatch_queue` (20 col) — fila. Status agregado atual:
  ```
  sent       6691
  cancelled  2873
  pending     632
  skipped     570
  suppressed    3
  failed        1
  ```
- `reengajamento_dispatch_runs` (17 col) — execuções
- `reengajamento_eventos` (7 col) — respostas
- `reengajamento_meta_disparos` (17 col) — telemetria Meta

### Kill switches
`system_flags`:
- `campaign_dispatch_enabled = true` (regularizado 13/07) — gate mestre
- `nutricao_enabled = false` — Central de Nutrição desligada por padrão
- `campanha_atrio_enabled = false` — kill switch manual

### RLS
Todas as tabelas rodam com service_role via crons. Frontend leitura escopada por corretor/gestor.

---

## 3. Fluxo de dados ponta a ponta

```
[Qualquer canal] ─┐
                  │
                  ▼
     nurturing-orchestrator (edge)
     ─────────────────────────────
     • Recebe {event_type, pipeline_lead_id, canal, metadata}
     • Get or create lead_nurturing_state
     • Aplica SCORE_MAP:
         whatsapp_entregue=+1, whatsapp_lido=+3, whatsapp_respondeu=+15
         email_enviado=+1, email_aberto=+3, email_clicou=+8
         vitrine_visualizada=+10, imovel_clicado=+12
         voz_atendida=+20, voz_nao_atendeu=0
         pediu_remocao=-50, sem_interacao_7d=-5, sem_interacao_14d=-10
         corretor_tarefa_feita=+5
     • Se whatsapp_respondeu → set conversation_window_until = now()+24h
     • Se score ≥ 30 (SCORE_QUENTE) → notify_corretor_hot + AI suggestion (Gemini)
     • Se score ≥ 15 (SCORE_MORNO) → AI suggestion
     • Se lead respondeu → cancela sequences pendentes, notifica corretor
     • Se pediu_remocao ou score<0 → status='opt_out', cancela tudo
     • Se hot em reativação → redistribute (fila CEO)
     • INSERT pipeline_atividades (timeline)


[Cron cron-nurturing-sequencer, 15min]
     ─────────────────────────────
     • Puxa lead_nurturing_sequences.status='pendente' e schedule_at<=now()
     • Para cada passo:
         → chama mailgun-send / whatsapp-send / voice-campaign-launcher
         → atualiza status='enviado'
         → dispara evento em nurturing-orchestrator


[Cron sweep-descartados, diário]
     ─────────────────────────────
     • Auto-archive leads em Descarte há 24h+
     • Excludes leads inativados / mantém em oferta ativa
     • Alimenta reengajamento_dispatch_queue


[Cron reengajamento (parado)]
     • reengajamento-descartados-enqueue → popula fila
     • reengajamento-retry-falhas → reprocessa
     • Trigger de saída: whatsapp-campaign-dispatch → template Meta
     • Resposta:
         SIM → reativar_lead_para_fila_ceo (histórico do template preservado)
         NÃO → arquiva definitivamente
```

---

## 4. Componentes e hooks

- `src/pages/CentralNutricao.tsx`
- `src/components/central-nutricao/*`, `src/components/nutricao/*`
  - `CadenciasTab.tsx`, `HistoricoEnviosTab.tsx`, `LeadsNutricaoTab.tsx`
- `src/pages/AutomacoesPage.tsx` (mais em domínio 13)
- Hooks: sem hook dedicado tanto no volume; centralizado em `useComunicacao` e chamadas diretas.

---

## 5. Edge Functions

| Function | Faz |
|---|---|
| `nurturing-orchestrator` | Cérebro event-driven de scoring/decisão. Chama `generateAISuggestion` (Gemini Flash Lite) para leads mornos+. |
| `cron-nurturing-sequencer` | Cron 15 min. Processa passos pendentes. |
| `sweep-descartados` | Cron diário. Auto-archive Descarte 24h. |
| `reengajamento-audience-preview` | Preview de quem entraria numa onda. |
| `reengajamento-descartados-enqueue` | Popula queue com descartados elegíveis. |
| `reengajamento-retry-falhas` | Reprocessa `status='failed'`. |
| `test-reengajamento-wave2` | Wave 2 de teste. |
| `recovery-agent` | Agente IA de recuperação (pouco usado). |
| `stalled-deals-notify` | Cron avisa gestor sobre negócios parados. |
| `nutricao-instance-connect` | Conecta instância Evolution dedicada a nutrição. |

---

## 6. Regras não óbvias

- **Score thresholds fixos no código**: `SCORE_QUENTE=30`, `SCORE_MORNO=15`. Não configurável via UI.
- **`whatsapp_respondeu` seta janela 24h automaticamente** — importante para deixar corretor mandar texto livre.
- **Lead em reativação que fica quente é redistribuído** — vai para fila CEO como "🔥 Lead REATIVADO pela IA".
- **AI suggestion só é gerada se `LOVABLE_API_KEY` está presente e score ≥ 15** — dupla atividade no timeline: uma "🔥 Lead QUENTE" + uma "🤖 Sugestão IA".
- **`created_by = '00000000-0000-0000-0000-000000000000'`** é a assinatura de eventos de sistema em `pipeline_atividades`.
- **Opt-out permanente**: score<0 ou `pediu_remocao` → status='opt_out' e cancela TODAS sequences pendentes.
- **Rate limits WhatsApp**: cap 250/dia, delay 3-6s, batch 30 (aplicado por `waba_send_guards`).
- **Templates de reengajamento**: routing SIM/NÃO usa botões Meta template (mem://features/whatsapp/reengajamento-resposta-routing).

---

## 7. Decisões de design

- **Reengajamento parado (13/07/2026)** por spam Meta — mem://features/whatsapp/reengajamento-parado-spam-meta: "Motor de disparo em massa desligado na fonte (3 travas: system_flags + reengajamento_config + fila cancelada); não reativar sem qualidade/base quente".
- **Nutrição/disparo manual only** (mem://features/whatsapp/nutricao-manual-only): "Sem disparo automático; gate único system_flags.campaign_dispatch_enabled (default false), sequencer/campanhas gated, crons inativos; só usuário libera".
- **Central de Reengajamento (/central-nutricao) 100% manual** — nota de topo do memory index.
- Fila CEO fallback: mem://features/roleta/fila-ceo-fallback.
- SCORE_MAP nasceu no código — nenhum lugar do banco parametrizado.

---

## 8. Dependências

**Consome de:**
- `pipeline-funil` (pipeline_leads)
- `comunicacao` (mailgun-send, whatsapp-send)
- `homi-ia` (Gemini via LOVABLE_API_KEY para suggestions)

**Produz para:**
- `pipeline-funil` (`pipeline_atividades`, notificações)
- `gestao-lideranca` (dashboards mostram estado)

---

## 9. Como religar com segurança (roadmap)

Checklist para reativar disparo automático:
1. Validar `meta_number_quality` verde por 7 dias
2. Reduzir cap p/ 100/dia por 1 semana
3. Ativar apenas 1 template por vez, monitorar delivery > 95%
4. Ligar `system_flags.nutricao_enabled=true`
5. Ligar `reengajamento_config.enabled=true` (linha a linha)
6. Retomar cron sequencer

## 9. Perguntas em aberto

1. `SCORE_MAP` hard-coded no `nurturing-orchestrator/index.ts` — deveria virar tabela de config?
2. Threshold `SCORE_QUENTE=30` — foi calibrado com dados reais ou é palpite?
3. `reengajamento_config` tem 36 colunas — quais são feature flags mortas vs ativas?
4. Existem 2873 mensagens `cancelled` na fila — foram canceladas pela pausa ou por opt-out?
5. Wave2 de reengajamento (`test-reengajamento-wave2`) — é teste ou produção?
6. `recovery-agent` — é a estrela solitária ou está deprecated?
7. Quando religar, qual o critério objetivo (métrica de qualidade Meta) que autoriza?
8. `nurturing_cadencias` vs `cadencia_sem_contato_passos` vs `pipeline_sequencias` — 3 tabelas de "cadência" coexistem. Qual é a oficial?
