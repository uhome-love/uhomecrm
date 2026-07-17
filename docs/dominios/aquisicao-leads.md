# Domínio 2 — Aquisição de Leads

> **Como o lead entra.** Cada canal tem uma edge function `receive-*` que normaliza, deduplica, taggeia e escreve em `pipeline_leads`. A distribuição para corretor é decidida por roleta + escala.

---

## 1. Propósito de negócio

Ingerir leads de múltiplos canais externos (Meta, Site UhomeSales, ImovelWeb, RD Station, TikTok, indicação, manual) de forma padronizada, evitando duplicatas, atribuindo automaticamente a um corretor disponível e disparando as primeiras cadências.

---

## 2. Tabelas envolvidas

### `pipeline_leads` (ver domínio 1) — destino final

### `leads` (legado)
- 23 colunas, 2 policies. Mantida por causa do trigger `trg_sync_site_lead_to_pipeline` que copia INSERT em `leads` → `pipeline_leads`.
- `leads_legado`, `leads_backup` — snapshots históricos, não escritos ativamente.

### `roleta_campanhas`
- Fonte de verdade de **qual segmento uma campanha alimenta** (ver mem: `mem://features/roleta/segment-resolution-source-of-truth`).
- Colunas: `id, campanha, segmento_id, ...`

### `roleta_credenciamentos`
- Corretores que estão elegíveis por segmento no turno atual. Trigger `trg_set_credenciamento_auth_user_id` resolve `profiles.id`↔`auth.users.id`.

### `roleta_fila`
- Ordem round-robin dos corretores elegíveis. DISTINCT ON `corretor_id` na leitura.

### `roleta_distribuicoes`
- Log de cada distribuição da roleta.

### `roleta_segmentos`, `roleta_config`, `roleta_desbloqueios`
- Config de segmentos, janelas de horário, exceções.

### `distribuicao_escala`
- 10 colunas. Escala manual — quem está de plantão em cada faixa horária/segmento.
- Triggers `trg_notify_escala_insert` / `trg_notify_escala_update`.

### `distribuicao_historico`
- Log paralelo, alimentado quando a decisão vem da escala ao invés da roleta.

### `corretor_disponibilidade`
- `user_id, dia_semana, hora_inicio, hora_fim, ativo, ...`. Trigger `trg_auto_remove_roleta_on_offline` remove da fila quando corretor fica indisponível.

### `meta_supressao`
- Números Meta bloqueados/opt-out. Consultado antes de reenviar template.

### `pipeline_estagnacao_config`
- Config de reciclagem por corretor.

### Índices críticos de dedup
Já listados em domínio 1:
- `idx_pipeline_leads_unique_email_active`
- `idx_pipeline_leads_unique_phone_active`
- `idx_pipeline_leads_jetimob_unique`

### RLS
Todas as `receive-*` funções rodam com service_role, ignorando RLS. `roleta_*` e `distribuicao_escala` têm policies de leitura ampla + escrita restrita a admin/gestor.

---

## 3. Fluxo de dados ponta a ponta

```
CANAIS EXTERNOS                    EDGE FUNCTIONS                DB
──────────────────                 ────────────────              ──
Meta Lead Ads Webhook ──POST──► receive-meta-lead ──┐
Meta backfill (cron 1h) ─────► meta-leads-backfill ─┤
uhomesales.com site ──POST──► receive-landing-lead ─┤
ImovelWeb ─────────POST────► receive-imovelweb-lead ┤
RD Station ────────POST────► receive-rdstation-lead ┤
TikTok Lead Gen ──POST─────► receive-tiktok-lead ───┤
Manual /pipeline-leads ────► supabase-js.insert() ──┤
                                                    ▼
                                        [Normalização + dedup]
                                                    │
                                                    ▼
                              INSERT pipeline_leads (service_role)
                                                    │
     ┌──────────────────────────────────────────────┴───────────────────┐
     │ TRIGGERS BEFORE INSERT                                            │
     │  • trg_normalize_phone      → telefone_normalizado                │
     │  • trg_auto_tag_campaign    → resolve `formulario`→`campanha`     │
     │  • trg_pipeline_leads_default_stage → stage_id = "Novo Lead"      │
     │  • trg_calcular_complexidade / trg_calcular_oportunidade          │
     │  • auto_archive_reengaj_descartado (se veio como Reengajamento)   │
     │  • trg_auto_distribute_new_lead                                   │
     │       └─► chama distribute-lead (via pg_net) ou grava distribuidor│
     └──────────────────────────────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                                     corretor_id preenchido
                                     aceite_status = 'pendente'
                                     aceite_expira_em = now()+X min
                                                    │
                                        ┌───────────┴────────────┐
                                        ▼                        ▼
                             UI corretor "aceita"         SLA expira sem aceite
                             → aceite_status='aceito'    → redistribuicao ou fila_ceo
```

**Meta Lead Ads (mais volumoso)**: fluxo real via webhook `receive-meta-lead` + rede de segurança `meta-leads-backfill` (cron horário via Graph API). Idempotência por `meta:{lead_id}` (mem://integracoes/meta-leads-backfill-safety-net). Volume 30d: **745 leads via `meta_backfill`** vs 22 `fb` + 172 `ig` + 13 `meta_ads` — evidência de que **o webhook direto vem falhando e o backfill assumiu**.

**Site UhomeSales**: dedup 24h por telefone (mem://integracoes/site-lead-deduplication-24h) — se cair no dedup, `origem` vira `site_uhome`.

**ImovelWeb**: apenas anexa histórico em campo texto com separador `---` (mem://integracoes/imovelweb-ingestion-logic).

**RD Station**: config de evento vazia; apenas o webhook simples (mem://integracoes/rd-station-webhook-sync).

Volume 30d observado (`SELECT origem, count(*)`):
```
meta_backfill          745
ig                     172
Reengajamento           89
Oferta Ativa            82
imovelweb               81
Manual                  27
fb                      22
site_uhome              21
meta_ads                13
Reengajamento (Nutrição)13
outro                   12
indicacao                3
```

---

## 4. Componentes e hooks do frontend

- `src/pages/PipelineLeads` — formulário "Novo Lead Manual"
- `src/pages/RoletaLeads.tsx` — dashboard da roleta
- `src/components/roleta/` — segmentos, credenciamento, filas
- `src/components/distribuicao/LeadsDistribuidosPanel.tsx`
- `src/pages/DisponibilidadePage.tsx` + `src/hooks/useCorretorDisponibilidade.ts`
- `src/hooks/useRoletaStatus.ts`, `useRoletaSegmentos.ts`, `useEquipesDisponiveis.ts`
- `src/hooks/useElegibilidadeRoleta.ts`
- `src/components/settings/RoletaCampanhasPanel.tsx` — mapeia campanhas Meta ↔ segmento

---

## 5. Edge Functions

| Function | Recebe | Efeito |
|---|---|---|
| `receive-meta-lead` | Payload webhook Meta (`entry.changes.value.leadgen_id`) | Fetch da Graph API + upsert pipeline_leads; grava `meta_lead_id`, `campanha_id`, `plataforma` |
| `meta-leads-backfill` | Cron `0 * * * *` (hourly) | Lista leadgen IDs recentes do Meta que não estão no CRM e insere. Idempotente por `meta:{lead_id}`. |
| `receive-landing-lead` | JSON site uhomesales | Aplica dedup 24h, origem `site_uhome` se colisão |
| `receive-imovelweb-lead` | Payload ImovelWeb | Anexa histórico texto |
| `receive-rdstation-lead` | Webhook RD | Insert simples |
| `receive-tiktok-lead` | Webhook TikTok Lead Gen | Insert simples |
| `distribute-lead` | `{lead_id}` | Consulta roleta_fila/distribuicao_escala, seta `corretor_id`, `aceite_expira_em` |
| `resolve-meta-forms` | Cron admin | Popula `meta_form_names` para tradução de form_id→nome |
| `roleta-shift-cleanup` | Cron fim de turno | Remove credenciados que saíram do turno |
| `crm-webhook` | Genérico | Ponte para integrações antigas |

---

## 6. Regras de negócio não óbvias

- **Dedup ignora descartados** — mesmo email volta como novo lead ativo se anterior foi descartado (feature de reengajamento, ver domínio 1).
- **`telefone_normalizado`** usa regra 8-dígitos (ver `phone-normalization-logic`).
- **Fila CEO fallback**: se roleta não consegue atribuir, lead vai para `pendente_distribuicao` — cron auto-redistribuição **DESLIGADO em 14/05/2026** (mem://features/roleta/fila-ceo-manual-only). Só sai por dispatch manual.
- **60s de grace period no aceite** para evitar race UI (mem://features/roleta/sla-grace-period-and-race-condition).
- **`is_redistribuicao=true`**: aceite anterior expirou, corretor tem status `respondeu` reset e SLA reiniciado.
- **Segmento sempre resolvido via `roleta_campanhas`**, nunca via `pipeline_leads.segmento_id` — este último pode estar defasado.
- **Atribuição manual bypassa a roleta** (`manual-attribution-policy`) — seta lead como aceito diretamente.
- **CAPI (Conversion API Meta)**: `capi_enviado_at` marca envio de conversão de volta para Meta (fluxo out).

---

## 7. Decisões de design em comentários/commits

- `mem://integracoes/meta-leads-backfill-safety-net`: cron horário foi criado como *rede de segurança* porque o webhook leadgen falha silenciosamente.
- `Site Lead Deduplication`: janela 24h — decisão para bloquear "click de curioso" repetido.
- `Fila CEO Manual Only` (14/05/2026): cron desligado após incidente de redistribuição indevida.
- `Runtime Direto Único v5` (16/05/2026): TODOS os wrappers de fetch removidos após incidente Wi-Fi residencial (mem://bugs/wifi-fetch-wrappers-13mai2026).

---

## 8. Dependências com outros domínios

**Consome de:**
- `admin-seguranca` (RLS, roles)
- `gestao-lideranca` (escala de gestor)

**Produz para:**
- `pipeline-funil` (todo lead vai virar row lá)
- `nutricao-reengajamento` (leads descartados retornam à fila)
- `marketing` (attribution por campanha/anúncio)

---

## 9. Perguntas em aberto para o fundador

1. `meta_backfill` responde por **74% dos leads Meta em 30d**. Isso indica que o webhook direto está quebrado — é intencional operar assim ou é um bug crítico a corrigir?
2. Existe tabela `leads` (legada) + `leads_legado` + `leads_backup`. Podemos aposentar oficialmente? O trigger `trg_sync_site_lead_to_pipeline` ainda escreve em `leads` — pra quê?
3. `receive-tiktok-lead` — TikTok Ads está ativo hoje? Só apareceu no listing, sem volume.
4. Cron redistribuição foi desligado em 14/05/2026. Isso é permanente ou temporário até resolver o bug original?
5. `distribuicao_escala` vs `roleta_*`: dois mecanismos coexistem. Qual manda em quais horários/segmentos? Regra clara?
6. `crm-webhook` (genérico) — ainda tem integração externa apontando para ele? Se sim, quem?
7. Dedup por email/telefone ignora descartados — se um cliente descartou por engano e o corretor descarta de novo, ele reentra pela terceira vez. É a intenção?
