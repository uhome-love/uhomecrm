# Dashboard CEO Beta — nova identidade visual (Inter + Montserrat · #4969FF)

Tela descartável para ver o novo design rodando com dados reais, sem tocar em nada que já está em produção.

## O que muda em relação ao mockup anterior

- **Tipografia:** Montserrat nos títulos, números de KPI e nomes de card. Inter no corpo, tabelas, labels e legendas, com números tabulares.
- **Cor:** o **#4969FF da U.Home vira a cor dominante** (`brand-500`) — ação primária, barra de KPI, item ativo da sidebar, barras de funil e ranking, anel de foco e destaque de linha. A escala completa (50 → 900) é derivada dele.
- **Neutros:** slate sai, entra uma escala fria que conversa com o azul. O cinza secundário sai de `#94A3B8` (2,9:1 — reprova AA) para `#69748C` (5,4:1 — passa AA).

## Como a tela beta funciona

- Nova rota **`/ceo-beta`**, acessível só para admin/CEO, **sem entrada no menu lateral** (acesso por URL). Nada de link para usuários comuns.
- A tela **reaproveita os hooks existentes** do dashboard atual (`useCeoDashboard` e os hooks de drill-down). Mesmos números, mesmas regras, mesmas queries — só a camada visual é nova.
- O dashboard atual em `/ceo` continua **intocado**. Se o beta não agradar, apaga-se a rota e a pasta de componentes e nada mais é afetado.

## O que a tela beta mostra

1. **Header + saudação** — nome, data BRT, horário de atualização, ações à direita (Fila CEO + Exportar).
2. **Seletor de período** em segmented control (Hoje / Ontem / Semana / Mês / 30 dias / Personalizado), com o mesmo estado do dashboard atual.
3. **5 KPIs** com barra semântica de severidade, delta versus período anterior e microcópia orientada à ação. Todos clicáveis, abrindo os mesmos drill-downs de hoje.
4. **Funil de negócios** com barras proporcionais e taxa de conversão por etapa.
5. **Rankings** (por corretor / origem / empreendimento) em barras na escala do azul.
6. **Tabela "Leads que exigem ação"** — linha de 48px, nome + origem em dois níveis, etapa em pill semântica, SLA explícito, VGV alinhado à direita, foco de teclado visível.

## Detalhes técnicos

- Novos arquivos, isolados: `src/pages/CeoDashboardBeta.tsx` e `src/components/ceo-beta/*` (KpiCard, FunilCard, RankingCard, LeadsAcaoTable, PeriodSegments).
- Os tokens novos entram como um **escopo local** (`.theme-beta` no container da página) definido em um CSS próprio, **sem alterar `src/index.css` nem `tailwind.config.ts`**. Isso garante zero risco de vazar estilo para as outras 200+ telas enquanto o beta estiver em avaliação.
- Fontes Montserrat e Inter carregadas com `display=swap` e preconnect no `index.html` (Inter já é usada hoje; entra só a Montserrat).
- Rota registrada em `App.tsx` com o mesmo guard de papel usado por `/ceo`, sem item no `Sidebar.tsx`.
- Zero mudança em hooks de dados, serviços, RPCs, edge functions, migrations ou schema.
- Validação ao vivo: abrir `/ceo-beta` no preview, comparar cada KPI e cada linha da tabela contra `/ceo` no mesmo período e confirmar que os números batem número a número.

## Depois da validação

Se aprovar, a Fase 1 (fundação global: tokens em `index.css`, escala tipográfica em `tailwind.config.ts`, componentes base e shell) sobe promovendo esses mesmos tokens para o produto inteiro. Se não aprovar, remove-se a rota, a pasta `ceo-beta` e o CSS local — o CRM volta ao estado atual sem resíduo.
