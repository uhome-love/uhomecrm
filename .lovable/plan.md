# Limpeza e unificação do menu (visão CEO)

Objetivo: menos páginas no menu, uma única central de resultado, uma única central de inteligência de anúncios/leads, e as páginas técnicas dentro de Configurações.

## O que os dados mostram (últimos 45 dias, page_views)

- `/central-relatorios`: 138 acessos, 12 usuários
- `/ranking` (Performance): 82 acessos, 12 usuários — `/performance` só 4
- `/central-dados`: 28 acessos, 2 usuários (último 23/07)
- `/integracoes`: 7 acessos (último 07/07)
- `/homi/base-conhecimento`: 1 acesso
- `/dados-anuncios`: 1 acesso (página nova)
- `/marketing` (dashboard Meta): 0 acessos
- `/homi-ceo`: 0 acessos

Conclusão: as fusões propostas não tiram nada de uso relevante do time.

## Fase 1 — Central de Relatórios absorve Performance

Hoje há duas centrais com sobreposição real: Central de Relatórios (seções Pipeline, Origem/Segmento, Oferta Ativa, SLA, Visitas, Negócios, Vendas, Metas, Cohort, Ranking) e Performance (abas Visão Geral, Ranking, Origem, Meu Progresso, Relatório 1:1).

- Manter uma única rota: `/central-relatorios`, com a navegação em grupos que já existe.
- Grupos finais: **Visão** (Visão Geral SSOT + resumo executivo) · **Comercial** (Pipeline, Origem, Oferta Ativa, SLA, Visitas) · **Resultado** (Negócios, Vendas, Metas, Cohort) · **Equipe** (Ranking, Meu Progresso, Relatório 1:1).
- A "Visão Geral" e o "Ranking" passam a ser os componentes da Performance (base SSOT `rpc_metricas`), que são a fonte única já validada; a seção Ranking antiga da Central é aposentada.
- "Origem" da Performance (ROAS/CPL/funil por origem) vira a seção Origem; a antiga Origem/Segmento é mesclada nela.
- `/ranking` e `/performance` viram redirect para `/central-relatorios?secao=...`; menu passa a ter só "Central de Relatórios".
- Corretor e gestor continuam com escopo próprio (mesma regra de role que a Performance já aplica hoje).

## Fase 2 — Central de Inteligência de Leads (anúncios + leads que performam)

Unificar "Dados Anúncios" e "Central de Marketing" (dashboard Meta, sem uso) numa página só, em `/dados-anuncios` renomeada para **Inteligência de Leads**:

- Aba **Investimento**: gasto, leads, CPL, CTR por campanha/conjunto/anúncio (dados do `meta-ads-sync`).
- Aba **Leads que performam**: coorte origem → qualificação → visita agendada → realizada → venda, com CPL por venda e ROAS.
- Aba **Criativos/Anúncios**: ranking de anúncio por lead qualificado e por visita.
- Aba **Rastreamento**: saúde do CAPI (eventos enfileirados/enviados, match quality, leads sem e-mail/fbc).
- Export PDF e CSV mantidos em todas as abas.
- Rota `/marketing` vira redirect; "Marketing Central" (agenda de conteúdo do backoffice) continua separada.

## Fase 3 — Configurações recebe as páginas técnicas

- **Integrações** vira seção dentro de Configurações; `/integracoes` mantém-se como redirect (o callback do Google já aponta para lá).
- **Central de Dados**: hoje são 3 abas — Funil, Forecast IA e Relatórios legados. O Funil e os Relatórios já estão cobertos pela Central de Relatórios; só o **Forecast IA** tem conteúdo único, e ele passa a ser uma seção da Central de Relatórios (grupo Resultado). A página `/central-dados` sai do menu e redireciona.

## Fase 4 — Base HOMI dentro de Materiais

- Base HOMI é a ingestão de documentos que alimenta a IA; Materiais é a biblioteca do corretor. Vira uma aba **Base HOMI (IA)** dentro de `/materiais`, visível só para admin/gestor.
- `/homi/base-conhecimento` continua funcionando como redirect; item sai do menu.
- Observação: `/scripts` ainda aparece separado (11 acessos) — sugiro incluir na mesma passada como aba de Materiais.

## Fase 5 — HOMI CEO só no botão do header

- O painel do header (HomiHeaderButton → HomiPanel) já resolve o papel por role e chama `uhome-ia-core` para CEO/gestor. A página `/homi-ceo` (chat dedicado, 0 acessos) sai do menu e redireciona para a home abrindo o painel.
- Se você quiser manter a análise semanal específica do `homi-ceo`, ela entra como um botão de ação rápida dentro do painel, em vez de página.

## Menu lateral resultante (CEO)

Principal: Dashboard · Roleta · Pipeline · Agenda · Oferta ativa · Mutirão · Busca · Estagnados
Vendas: PDN · Vendas realizadas · Intermediação · Simulador
Gestão: Meu Time · Presença · Foco Corretores · Placar do Dia · **Central de Relatórios** · **Inteligência de Leads**
Crescimento: Reengajamento
Ferramentas: Imóveis · Materiais
(Integrações e Central de Dados passam para Configurações; HOMI CEO, Marketing, Performance, Base HOMI saem do menu.)

## Detalhes técnicos

- Arquivos principais: `src/components/layout/Sidebar.tsx`, `src/config/pageRegistry.ts`, `src/App.tsx` (redirects), `src/pages/CentralRelatoriosV2.tsx` + `src/components/central-v2/sections.ts`/`CentralNav.tsx`, `src/pages/CentralPerformance.tsx` (componentes reaproveitados), `src/pages/RelatorioOrigemPerformancePage.tsx`, `src/components/marketing/MarketingDashboard.tsx`, `src/pages/CentralDados.tsx`, `src/pages/IntegracoesPage.tsx`, `src/pages/Configuracoes.tsx`, `src/pages/MateriaisPage.tsx`, `src/pages/BaseConhecimento.tsx`.
- Nenhuma migration nesta etapa: é reorganização de frontend. As RPCs `rpc_metricas`, `rpc_metricas_origem` e `get_relatorio_*` continuam como estão.
- Convivência de fontes: a Central de Relatórios usa `get_relatorio_*` e a Performance usa o SSOT `rpc_metricas`. Nesta reorganização as duas convivem no mesmo shell; a consolidação numérica em cima do SSOT fica como fase seguinte, para não misturar mudança de layout com mudança de número.
- Execução por fases, uma de cada vez, com mockup antes do build e validação ao vivo no preview a cada fase.
