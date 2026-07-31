# Redesign U.Home CRM — Fase 1: Fundação + Shell

Auditoria feita nas telas reais (Pipeline, Minha Rotina, Tarefas, Imóveis, Dashboard CEO) e no design system atual. Esta fase troca a **base visual do produto inteiro** — tokens, tipografia, contraste, sidebar, header, botões, cards e tabelas. Nenhuma regra de negócio, query, RPC ou tabela é tocada.

## O que está errado hoje (verificado no código e nas telas)

| Problema | Evidência |
|---|---|
| Texto secundário reprova acessibilidade | `--muted-foreground` = `#94A3B8` sobre branco = **2,9:1** (WCAG AA exige 4,5:1). É a cor de quase todo subtítulo, label e legenda do CRM |
| Cor hardcoded fora do design system | **1.396 ocorrências** de `text-white`, `bg-gray-*`, `bg-slate-*`, `bg-[#...]` em **176 arquivos**, mais 183 arquivos com `style={{}}` inline. Qualquer troca de paleta hoje deixa telas "meio antigas, meio novas" |
| Escala tipográfica com buraco | Existe `base` (14px) e pula direto para `lg` (18px). Não há passo intermediário, então títulos de seção viram 14px em negrito — sem hierarquia real |
| Densidade inconsistente entre telas | Pipeline: 4 KPIs gigantes + 3 cards de equipe e o resto da tela vazia. Imóveis: grid apertado, cards colados, sem respiro. São dois produtos diferentes |
| Botões sem hierarquia clara | 12 variantes no `Button`, várias concorrendo entre si (`success`, `warning`, `outline-success`, `outline-warning`). Na prática o corretor não sabe qual é a ação principal da tela |
| Sem estados de foco/loading padronizados | `focus-visible` existe no Button, mas listas, cards clicáveis e linhas de tabela não têm estado de foco — navegação por teclado fica invisível |
| Ícone-only sem rótulo | Botões de ícone sem `aria-label` em várias telas — leitor de tela anuncia "botão" |

## Direções aprovadas

- **Paleta: Grafite & Indigo Profundo** — base grafite/carvão, superfícies brancas frias, indigo profundo como cor de ação.
- **Densidade: Confortável** (recomendação confirmada abaixo).
- **Escopo: Fundação + Shell** — reflete automaticamente em todas as telas.

### Tipografia — recomendação

Você pediu a linha Poppins/Montserrat (geométrica, redonda, "cara de marca"). Poppins puro tem dois problemas em CRM: números com largura irregular em tabelas e um ar genérico de template. Proposta na mesma família visual, com melhor desempenho em dados densos:

- **Recomendado — Outfit (títulos) + Plus Jakarta Sans (corpo e tabelas).** Outfit é geométrico como Poppins, porém mais afiado e com títulos que sustentam peso 600/700. Plus Jakarta tem números tabulares excelentes e mantém legibilidade a 13px.
- **Alternativa fiel ao pedido — Montserrat (títulos) + Inter (corpo).** Montserrat entrega exatamente o ar Poppins/Montserrat que você citou; Inter continua no corpo por já estar validado em tabelas.

Escolho **Outfit + Plus Jakarta Sans** no plano. Se preferir Montserrat + Inter, é só dizer na aprovação — é uma linha de config.

### Densidade — por que Confortável

Comparando com o mercado: Linear e Attio usam linhas de ~36px porque o usuário passa o dia inteiro varrendo listas. Pipedrive, HubSpot e Salesforce Lightning — CRMs onde o usuário **decide** em cada linha em vez de varrer — usam 48-56px. O corretor lê nome, empreendimento, etapa, SLA e tempo parado antes de agir; linha apertada aumenta erro de clique e leitura. Vai **Confortável (48px) como padrão**, com toggle Compacto salvo por usuário nas telas de lista pesada (Pipeline, Imóveis, Tarefas, Vendas) na Fase 2.

## O que será construído nesta fase

### 1. Tokens de cor (`src/index.css`)
Nova escala grafite substituindo a slate atual, indigo profundo `#2B3FA8` como `--primary`, superfícies em três níveis (página / card / card elevado) e correção de contraste:
- `--muted-foreground` sobe para grafite ~`#5A6377` → **4,8:1** (passa AA)
- Cores de status (success/warning/danger) rebalanceadas para o novo fundo, com variantes `-fg` legíveis sobre pill claro
- Sidebar grafite profundo alinhado à nova base, item ativo com barra indigo em vez de fundo cheio
- Sombras trocadas por conjunto de 3 níveis suaves (ambiente + contato), sem sombra dura

### 2. Tipografia (`tailwind.config.ts` + `index.html`)
- Fontes carregadas com preload (mesmo padrão atual, sem render-blocking)
- Escala completa e sem buraco: `2xs 11 · xs 12 · sm 13 · base 14 · md 15 · lg 17 · xl 20 · 2xl 24 · 3xl 30`
- `line-height` amarrado por tamanho (1.5 em corpo, 1.25 em títulos) e `letter-spacing` negativo progressivo nos títulos
- Números em tabelas com `font-variant-numeric: tabular-nums` global — colunas de valor param de dançar

### 3. Espaçamento e raio
- Escala 4/8 aplicada nos tokens de espaçamento de página, seção e card
- Raio consistente: 8px em controles, 12px em cards, 16px em modais e painéis

### 4. Componentes base
- **Button:** 12 variantes reduzidas a **5 papéis** — `primary`, `secondary`, `ghost`, `outline`, `destructive` — mais um modificador `tone` (success/warning) para casos de status. Estados hover/active/focus/loading padronizados, com spinner embutido e `aria-busy`
- **Card:** um único componente com variantes `flat`, `raised`, `interactive` (hover eleva + borda indigo)
- **Tabela/Lista:** cabeçalho fixo, zebra sutil, linha com estado hover/focus/selected, altura confortável de 48px, coluna de ação alinhada à direita
- **Badge/Pill de etapa:** cores derivadas dos tokens, contraste AA garantido em todas as etapas do pipeline
- **Skeletons:** shimmer padrão substituindo os "0" e telas em branco durante carregamento
- **Estado vazio:** componente único com ícone, frase e ação sugerida (hoje é texto solto centralizado)

### 5. Shell (sidebar + header)
- **Sidebar:** hierarquia tipográfica real entre grupo e item, ícones alinhados em grid de 20px, item ativo com barra + peso, densidade reduzida para caber mais sem apertar, colapso para strip de ícones preservando os rótulos em tooltip
- **Header:** altura fixa, busca com atalho visível, ações à direita agrupadas, avatar/menu com contraste corrigido
- **Container de página:** largura máxima e padding uniformes; hoje cada tela define o seu

### 6. Acessibilidade
- Todo botão ícone-only do shell e dos componentes base ganha `aria-label`
- Anel de foco visível e consistente em links, cards clicáveis e linhas de tabela
- `<main>` único por rota no layout

## Detalhes técnicos

- Arquivos centrais: `src/index.css`, `tailwind.config.ts`, `index.html`, `src/components/ui/*` (button, card, table, badge, skeleton, input, tabs), `src/components/layout/Sidebar.tsx` e o shell/header.
- **Migração das 1.396 cores hardcoded:** nesta fase é feita a varredura mecânica dos casos de mapeamento direto (`text-white` → `text-primary-foreground` no contexto certo, `bg-gray-50` → `bg-muted`, `text-gray-500` → `text-muted-foreground`), arquivo por arquivo com verificação visual. Casos com cor de marca ou gráfico ficam para as fases de tela, onde há contexto.
- Componentes com estilo inline (`style={{}}`) usados em PDF/relatórios (`src/components/relatorios/origem/*`, `centralPdf.ts`) **não** são migrados — precisam de cor literal para exportar.
- Zero mudança em hooks, serviços, RPCs, edge functions, migrations ou schema.
- Validação: typecheck + captura Playwright antes/depois de Dashboard CEO, Pipeline, Minha Rotina, Tarefas e Imóveis, comparando lado a lado, mais checagem de contraste dos pares de token novos.

## Fases seguintes (para aprovar depois, uma por vez)

- **Fase 2 — Jornada do Corretor:** Minha Rotina como centro de comando do dia, Pipeline com cards enxutos e sinal de SLA, Detalhe do Lead reorganizado em coluna de contexto + timeline, toggle de densidade.
- **Fase 3 — Gestor/CEO:** dashboards com hierarquia de leitura (o que importa primeiro), deltas e drill-down consistentes.
- **Fase 4 — Imóveis & Vitrine:** cards de imóvel premium, mapa integrado, vitrine enviada ao cliente com cara de material de alto padrão.
- **Fase 5 — Micro-interações:** transições de etapa, celebração de venda, feedback de ação otimista.
