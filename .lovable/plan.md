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

## Princípios de organização do CRM (regem todas as fases)

1. **Uma verdade só por métrica.** Cada número tem uma origem única e documentada: VGV/vendas, visitas, leads e metas vêm do SSOT (`rpc_metricas` / `v_fato_*`). Nenhuma tela nova pode calcular métrica no frontend nem consultar tabela crua para número que já existe no SSOT.
2. **Uma tela por assunto.** Nada de duas páginas mostrando a mesma coisa. Se duas telas se sobrepõem, uma vira seção da outra e a antiga só existe como redirect.
3. **Nada de remendo.** Não se resolve divergência escondendo card ou ajustando número na tela: corrige-se na fonte (view/RPC) e todas as telas herdam.
4. **Rota é contrato.** Rota antiga nunca morre sem redirect; link salvo, notificação e PDF antigos continuam funcionando.
5. **Papel define escopo, não a tela.** Corretor vê o próprio, gestor vê a equipe, diretor vê as equipes, CEO vê tudo — na mesma página, com o mesmo número.

## Padrão de rotas (frontend)

- Nomes em português, minúsculas, sem acento, hierarquia por prefixo. Padrão final:
  - `/central-relatorios` (resultado e performance, seções via `?secao=`)
  - `/inteligencia-leads` (anúncios + leads que performam; `/dados-anuncios` e `/marketing` redirecionam)
  - `/configuracoes?secao=integracoes|sistema|meta-ads|perfil|notificacoes`
  - `/materiais?aba=biblioteca|scripts|base-homi`
- Toda rota registrada em `src/config/pageRegistry.ts` com role obrigatória — sem rota "solta" no `App.tsx` fora das públicas.
- Redirects declarados num único mapa (`LEGACY_REDIRECTS`) em vez de espalhados, e refletidos em `src/lib/routePatterns.ts` para o tracking de `page_views` não gerar `/_unknown`.
- Estado de navegação sempre na URL (`?secao=`, `?aba=`, período/filtro), para link compartilhável e retomada de contexto.

## Padrão de dados (backend)

- Camadas: **fatos** (`v_fato_venda`, `v_fato_visita`, ...) → **RPCs de leitura** (`rpc_metricas*`, `get_relatorio_*`) → **hooks** (`useMetricasSSOT`, `useRelatoriosCentral`) → **telas**. Tela nunca pula camada.
- Nomenclatura: `v_fato_*` para fatos, `v_kpi_*` para agregados, `rpc_*` para leitura, `get_*`/verbo para ação. Nada de `_v2`/`_novo`.
- Convergência SSOT: enquanto `get_relatorio_*` e `rpc_metricas` coexistirem, cada seção declara sua fonte no rodapé ("fonte: SSOT"), e a migração de cada seção para o SSOT é uma fase própria, com conferência número a número antes de trocar.
- Sem migration nas fases 1–5 (é reorganização de frontend). Qualquer ajuste de dado que aparecer vira fase separada, respeitando o limite de 2 migrations/dia em horário comercial.

## Regra de "não quebrar" e validação ponta a ponta

Cada fase só é dada como pronta depois deste checklist, executado ao vivo no preview:

1. Rotas antigas: abrir cada URL aposentada e confirmar redirect correto (sem 404, sem loop).
2. Papéis: entrar/simular como corretor, gestor, diretor e CEO e confirmar escopo e permissão em cada seção.
3. Números: comparar 3 métricas-chave (VGV do mês, visitas agendadas, leads do mês) entre a tela nova e a tela antiga antes de aposentar a antiga — divergência bloqueia a fase.
4. Navegação: menu lateral, abas do topo, busca global e notificações que apontam para as rotas mexidas.
5. Técnico: build/typecheck limpos, console sem erro novo, sem chamada de rede quebrada no preview.
6. Só depois disso o item sai do menu; a página antiga fica como redirect por pelo menos um ciclo antes de qualquer remoção de código.

## Ordem de execução

Fase 1 (Relatórios+Performance) → validação → Fase 3 (Configurações recebe Integrações e Forecast) → validação → Fase 4 (Materiais absorve Scripts e Base HOMI) → validação → Fase 5 (HOMI CEO só no header) → validação → Fase 2 (Inteligência de Leads, a maior) → validação. As fases pequenas primeiro reduzem risco e já limpam o menu; a Inteligência de Leads entra por último, com mockup dedicado.
