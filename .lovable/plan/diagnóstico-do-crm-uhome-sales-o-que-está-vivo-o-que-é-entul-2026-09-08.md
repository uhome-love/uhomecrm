# Diagnóstico do CRM Uhome Sales — o que está vivo, o que é entulho e como limpar

Nada foi alterado. Este é o retrato do sistema hoje, baseado no código (956 arquivos em `src`, 121 funções no backend) e no uso real registrado nos últimos 60 dias (`page_views`, 40 usuários).

## 1. O que está ativo e funcionando hoje

Ordenado por uso real (visualizações / pessoas distintas nos últimos 60 dias):

| Tela | Uso | Situação |
|---|---|---|
| Pipeline de Leads (`/pipeline-leads`) | 18.323 / 40 | Coração da operação |
| Minha Rotina do corretor (`/corretor`) | 13.615 / 38 | Ativo |
| Agenda / Tarefas (`/minhas-tarefas`) | 8.121 / 37 | Ativo |
| Home / redirecionador (`/`) | 4.007 / 40 | Ativo |
| Visitas (`/agenda-visitas`) | 3.401 / 37 | Ativo |
| Aceite de Leads (`/aceite`) | 3.096 / 33 | Ativo |
| Dashboard CEO (`/ceo`) | 2.516 / 3 | Ativo (uso concentrado) |
| Oferta Ativa do corretor (`/corretor/call`) | 1.766 / 32 | Ativo |
| Mutirão ao Vivo (`/oferta-ativa-ao-vivo`) | 1.150 / 31 | Ativo em dias de mutirão |
| Notificações | 1.091 / 36 | Ativo |
| Imóveis | 850 / 33 | Ativo |
| LIA Hub, Reengajamento, Leads Estagnados, Recrutamento, Presença da Roleta, Materiais, Vendas, Academia, Foco Corretores, Cockpit do Gerente, HOMI | 200–420 cada | Ativos, público restrito |
| Relatórios/Performance, Roleta, Busca de Leads, Meu Time, Configurações, Simulador, Intermediação, Base Única, Vitrines | 30–210 | Ativos, uso baixo/pontual |

Fluxos de backend efetivamente vivos: entrada de leads (Meta/site), roleta e distribuição, tarefas e toques, visitas, negócios/VGV, reengajamento LIA (WhatsApp), CAPI, HOMI/RAG, push.

## 2. Código morto e entulho identificado

**112 arquivos sem nenhum import em todo o projeto** (verificado resolvendo cada import de `src`, incluindo imports dinâmicos). Grupos:

- **Telas/painéis órfãos**: `DashboardV4Page`, `PerformanceV3`, `MegaRelatorio`, `ReportTabs`, `ReportFilters`, `ReportPlaceholder`, `CentralNav`, `FunilContent`, `ReportsContent`, `TarefasPage`, `CorretorHome`, `EquipesViewPlaceholder`, `ModoTimePlaceholder`.
- **HOMI duplicado**: `HomiChat`, `HomiCeoChat`, `HomiPanel`, `HomiAvatar`, `HomiGreeting`, `HomiIdeiasChat` — versões antigas convivendo com o HOMI atual.
- **Nutrição antiga** (substituída pela Central de Reengajamento): `nutricao/CadenciasTab`, `HistoricoEnviosTab`, `LeadsNutricaoTab`.
- **Ranking antigo** (6 arquivos), **Pulse** (4), **Referral** (2), **Academia** (6 arquivos da versão pré-módulos), **Pagadorias** (3), **Oferta Ativa** legado (6: `CampaignManager`, `ImportListPanel`, `PosLigacaoDialog`, `SessionCoachingModal`, `ArenaSessionSummary`, `OfertaAtivaBanner`), **admin/uso-paginas** (3).
- **Pipeline**: `RadarImoveisTab` (1.303 linhas), `JornadaLead`, `JourneyMissionCard`, `MissionBriefingDrawer`, `QuickActionMenu`, `VendaCelebration`.
- **Hooks e libs órfãos**: `useKPIs`, `useGerenteDashboard`, `useSmartAlerts`, `useLeadsParados`, `useLeadMatch`, `useCorretoresDisponiveis`, `lib/leadScoring`, `lib/taskGenerator`, `lib/centralPdf`, `lib/zIndex`, `services/siteImoveis`.
- **17 componentes `ui/` nunca usados** (carousel, chart, menubar, resizable, etc.) — baixo risco, ganho pequeno.

**Arquivos gigantes (dívida estrutural, não morta)**: `PipelineStageTransitionPopup` 1.397, `DialingModeWithScript` 1.366, `ImoveisPage` 1.334, `CompletionForm` 1.311, `RecrutamentoKanban` 1.266, `PipelineBoard` 1.200, `PipelineLeadDetail` 1.189, `CeoDashboard` 1.152, `AgendaVisitas` 1.099, `usePipeline` 1.006. A regra do projeto é dividir acima de 500–800 linhas.

**Rotas fantasma** ainda registradas mas sem uso há mais de 30 dias: `/performance`, `/ranking`, `/scripts`, `/central-dados`, `/pos-vendas`, `/rh/entrevistas`, `/homi/base-conhecimento`, `/relatorio-geral`, `/raio-x-corretor`, `/materiais/analytics`, `/central-usuarios`, `/produtividade`, `/inicio-novo`, `/ceo/novo-design`, `/negocios-preview`, além das 5 páginas `preview-relatorio-*`.

**Backend**: 13 agendamentos automáticos ainda apontam para funções que não existem mais no repositório (Typesense, automações, relatório mensal, Jetimob catálogo, Mailgun). Eles falham silenciosamente e consomem execução.

**Duplicidades de fluxo**: tarefas x atividades x cadências; PDN x Pipeline; Relatórios x Performance x Central de Relatórios; Nutrição x Reengajamento; três assistentes de IA (HOMI, LIA, uhome-ia-core).

## 3. Plano de limpeza (fases pequenas, cada uma validada antes da próxima)

**Fase 0 — rede de proteção (sem apagar nada)**
Registrar a lista congelada dos 112 órfãos, rodar typecheck/build de referência e confirmar as telas críticas no preview (Pipeline, Minha Rotina, Agenda, Visitas, Aceite).

**Fase 1 — quarentena, não deleção**
Mover os órfãos para `src/_legacy/` mantendo a estrutura de pastas. Se algo quebrar, volta em um comando. Build + typecheck + passagem pelas 11 telas mais usadas.

**Fase 2 — deleção dos órfãos confirmados**
Após 1 semana em produção sem incidente, apagar `src/_legacy/`. Ganho estimado: ~15% dos arquivos de `src`.

**Fase 3 — rotas fantasma**
Remover as rotas sem uso do `pageRegistry`/`App.tsx` e as 5 páginas de preview de relatório, mantendo redirecionamento para o hub equivalente para não quebrar link salvo.

**Fase 4 — agendamentos quebrados**
Desativar os 13 crons que apontam para funções inexistentes (um a um, com confirmação do que cada um deveria fazer).

**Fase 5 — quebra dos arquivos gigantes**
Um arquivo por vez, começando por `usePipeline.ts` e `PipelineLeadDetail.tsx`: extrair sub-hooks/subcomponentes sem alterar comportamento, validando a tela ao vivo a cada divisão.

**Fase 6 — unificação de fluxos duplicados**
Só depois da limpeza física, e cada unificação (relatórios, nutrição x reengajamento, tarefas x atividades) vira decisão sua com mockup antes do código.

Regras da limpeza: nenhuma mudança de comportamento nas fases 1–4; nada de deleção em massa numa tacada; cada fase termina com validação ao vivo no preview antes de seguir.

## Detalhes técnicos

- Detecção de órfãos: resolução real de `import`/`import()` com aliases `@/`, partindo de `src/main.tsx` e `src/App.tsx`; arquivos `.d.ts` e testes excluídos.
- Uso das telas: `page_views.route_pattern` agregado em 60 dias.
- Não foram consideradas mortas funções de backend sem log — a ausência de evento em `ops_events` não prova ausência de uso.
