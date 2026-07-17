# Domínio 6 — Imóveis & Produto

## 1. Propósito
Catálogo de imóveis (empreendimentos + unidades), sincronizado com Jetimob (fonte de verdade externa) e espelhado com o site uhomesales.com. Serve o Radar (match lead↔imóvel), Vitrines (páginas públicas) e Materiais (drives/scripts/apresentações por empreendimento).

## 2. Tabelas
- `imoveis_catalog` (20 col) — catálogo bruto sincronizado da Jetimob
- `imoveis_catalog_sync_status` — última sincronização
- `imoveis_interesse` — interesse manual
- `properties` (61 col) — versão enriquecida
- `property_price_history`, `property_sync_log`
- `jetimob_corretores` (17 col) — mapa corretor↔Jetimob
- `jetimob_processed`, `jetimob_campaign_map`
- `empreendimento_fichas` (11 col) — dados curados por empreendimento
- `empreendimento_overrides` (33 col) — sobrescreve campos vindos da Jetimob
- `materiais_empreendimentos`, `materiais_links`, `anuncio_materiais`
- `vitrines`, `vitrine_interacoes`
- `lead_property_profiles`, `lead_property_matches`, `lead_property_searches`, `lead_property_interactions`, `lead_imoveis_indicados`, `lead_imovel_events`
- `perfil_interesse`, `typesense_sync_state`

## 3. Fluxo
```
Jetimob API ──► jetimob-proxy / jetimob-sync-catalog (cron) ──► imoveis_catalog
                                                        └────► properties
                                                        └────► typesense-sync ──► Typesense (busca)
jetimob-sync-corretores ──► jetimob_corretores

UI (radar) ──► lead-property-match ──► lead_imoveis_indicados
UI (vitrine) ──► useCreateVitrine ──► vitrines (públicas via vitrine-public / vitrine-og / imovel-og)
Site uhomesales ──► sync-status-to-site (out) e mirror in
```

Ver também `mem://integracoes/jetimob-architecture-config`, `mem://integracoes/crm-site-imoveis-mirror`, `mem://integracoes/site-crm-sync-logic`, `mem://features/imoveis/vitrine-radar-architecture`.

## 4. Componentes/hooks
- `src/pages/ImoveisShell.tsx`, `ImovelPage.tsx`, `VitrinePage.tsx`, `MinhasVitrines.tsx`
- `src/components/imoveis/*`, `src/components/showcase/*`, `src/components/materiais/*`
- Hooks: `useCreateVitrine`, `useLeadPropertyMatches`, `useLeadPropertyProfile`, `useLeadPropertySearch`, `useLeadIntelligence`, `useTypesenseSearch`, `useMateriais`, `useMateriaisMutations`, `useMarketplace`
- `src/services/siteImoveis.ts`, `siteImoveisRemote.ts`, `negociosRelinkService.ts`
- Stores: `src/stores/imoveisSearchStore.ts`

## 5. Edge Functions
| Fn | O que faz |
|---|---|
| `jetimob-proxy` | Proxy Jetimob (auth + rate limit) |
| `jetimob-sync-catalog` | Cron sync catálogo |
| `jetimob-sync-corretores` | Sync corretores |
| `typesense-sync` / `typesense-admin` / `typesense-search` / `ai-search-imoveis` | Busca |
| `vitrine-public`, `vitrine-bridge`, `vitrine-og`, `imovel-og` | Vitrine pública + OpenGraph |
| `site-events`, `site-proxy`, `sync-status-to-site` | Mirror com site |
| `lead-property-match` | Radar |

## 6. Regras não óbvias
- Webhooks Jetimob via Make.com (mem://integracoes/jetimob-architecture-config) — legacy functions removed.
- `imovel_codigo` é PK de sync com site (mem://integracoes/site-crm-sync-logic).
- URL formato `/imovel/{slug}`.
- Vitrine fallback → busca CRM (mem://features/imoveis/vitrine-radar-architecture).
- `empreendimento_overrides` (33 col) permite curadoria manual sobre dados Jetimob.

## 7. Decisões
- Migração para Make.com como orquestrador de webhooks Jetimob (legado removido).
- CRM↔Site profile sync por `uhomesales_id` (mem://integracoes/crm-site-profile-sync).

## 8. Dependências
Consome: `admin-seguranca`. Produz para: `pipeline-funil` (radar), `visitas` (endereço), `marketing` (vitrines).

## 9. Perguntas
1. `imoveis_catalog` vs `properties` — dois catálogos coexistem. Qual é oficial?
2. `empreendimento_fichas` vs `empreendimento_overrides` — separação clara ou dívida?
3. Typesense está ativo em produção? `typesense_sync_state` tem quantos registros vs volume real?
4. Vitrines públicas — quantas ativas por corretor em média? Existe expiração?
5. `anuncio_materiais` — para que serve exatamente?
