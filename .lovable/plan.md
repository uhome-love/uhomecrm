
## Objetivo

Gerar **um único documento Markdown** — `uhome-sales-crm-documentation.md` — em `/mnt/documents/`, estruturado nos 18 tópicos solicitados, detalhado o bastante para que outra IA atue como consultora de gestão comercial e desenhe novos fluxos sem precisar ler o código.

Nenhum arquivo do projeto será alterado. É puro trabalho de leitura + escrita de artefato.

## Como vou montar

### Fase 1 — Coleta (read-only, em paralelo)

1. **Memórias do projeto** (`mem://index.md` já em contexto): abrir as memórias mais densas para regra de negócio — pipeline, roleta, WhatsApp, negocios, oferta-ativa, nurturing, reengajamento, gerente, CEO, id-mapping, RLS, PDN, simulador.
2. **Banco de dados**: rodar `supabase--read_query` para extrair `information_schema` — colunas, tipos, FKs e políticas RLS das ~180 tabelas listadas. Agrupar por domínio (pipeline, roleta, negocios, whatsapp, oferta ativa, academia, etc.).
3. **Estrutura de código**:
   - `src/pages/` → lista completa de telas + rotas em `src/App.tsx`.
   - `src/components/` por domínio → componentes principais.
   - `src/hooks/` → hooks canônicos e o que cada um resolve.
   - `src/lib/` → serviços (metricsService, leadHelpers, taskScheduling, financiamento, etc.).
   - `supabase/functions/` → edge functions (integrações, crons, disparos).
4. **Fluxos-chave** — leituras direcionadas: `Auth.tsx`, `AppLayout.tsx`, `ProtectedRoute`, `RoleProtectedRoute`, `useUserRole`, `PdnKanban`, `PipelineLeads`, `RoletaLeads`, `OfertaAtiva`, dashboards V3/V4, `taskGenerator`, `nurturing`, `reengajamento`.

### Fase 2 — Redação do Markdown

Estrutura final do documento (espelha os 18 tópicos do pedido):

```text
1.  Visão Geral (objetivo, stack, arquitetura, camadas canônicas)
2.  Fluxo do Corretor (login → roleta/atribuição → pipeline → visita → negócio → contrato)
3.  Fluxo do Gerente (dashboards V3/V4, PDN, 1:1, aprovações, metas, time)
4.  Fluxo do Admin/Diretor (usuários, roles, integrações, feature flags, radar OA)
5.  Banco de Dados (por domínio: pipeline, roleta, negocios, whatsapp, academia, marketing, RH, etc. — colunas essenciais, FKs, RLS, ID convention)
6.  Estrutura de Leads (7 etapas ativas + substatus flag_status + Ganho/Descarte/Inativar; ciclo de vida, dedup, reativação)
7.  Tarefas (geração automática por etapa, playbooks, sequências, SLA/atraso, Central de Tarefas)
8.  Agenda (visitas, integração Google Calendar, sala de reunião RH, agenda marketing)
9.  Dashboards (Corretor, Gerente V3/V4, CEO, Backoffice, Marketing, RH) — cada KPI com fórmula e view
10. Ranking (pesos 20/30/40/10 — prospecção, gestão, vendas, eficiência; fórmulas)
11. Oferta Ativa (listas, dedup vs pipeline, arena, templates, ranking, radar, anti-fadiga)
12. Busca de Imóveis (Vitrine × Radar, Typesense, siteImoveisRemote, filtros canônicos)
13. Permissões (admin, diretor, gestor, corretor, backoffice, rh — matriz por rota/ação)
14. APIs / Integrações (Meta Ads, Meta Leads backfill, WhatsApp Meta + Evolution, RD Station, ImovelWeb, Jetimob, Mailgun, ElevenLabs, Typesense, Google Calendar, Site Uhome, Cloudflare)
15. Front-end (mapa de rotas, componentes principais por domínio, design system)
16. Regras de Negócio (todas as regras memorizadas: BRT, id-mapping, exclusividade OA, VGV assinado=fase vendido, 48h/72h reciclagem, roleta janelas, anti-fadiga 21d, etc.)
17. Automações (crons, triggers, sequencers, nurturing, reengajamento, auto-archive descarte 24h, roleta shift cleanup, edge health, meta backfill 1h)
18. Pontos de Melhoria (análise crítica: dívida técnica, riscos WABA, id-mapping duplo, cache pipeline, cobertura de testes, observabilidade, oportunidades de IA)
```

Cada tópico terá:
- **O que é** (definição funcional)
- **Onde vive** (tabelas/arquivos-chave)
- **Como funciona** (fluxo passo a passo)
- **Regras/edge cases** (BRT, RLS, dedup, SLAs)

Tamanho estimado: 40–80 KB de Markdown (grande, mas legível por IA).

### Fase 3 — Entrega

- Escrever em `/mnt/documents/uhome-sales-crm-documentation.md`.
- Emitir `<presentation-artifact>` para download.
- Resposta curta ao usuário confirmando a entrega.

## O que **NÃO** vou fazer

- Não altero código, migrations, memórias, nem configs.
- Não incluo secrets, IDs do Supabase, nem chaves.
- Não invento comportamentos — se algo não estiver claro no código/memória, marco como *"a confirmar"* no documento em vez de chutar.

## Confirmação necessária

Só preciso que você aprove o plano. Depois disso, executo a coleta + redação e devolvo o `.md` como artefato para você baixar.
