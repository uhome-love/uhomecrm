## Objetivo

1) Tirar o card "Presença da Roleta" do Dashboard CEO (só CEO — o do gestor fica como está por enquanto).
2) Trazer esses mesmos KPIs (Corretores / Na empresa / Pendentes / Saíram) pra topo da página **Presença** (`/roleta/presenca`).
3) Auditar a página Presença em mobile e ajustar o que estiver quebrado.

---

## Escopo 1 — Remover do Dashboard CEO

Arquivo: `src/pages/CeoDashboard.tsx`
- Remover a linha 444 (`<PresencaSummaryCard scope="ceo" />`) e o import da linha 34.
- Não mexo em `V4PanelRoleta` (dashboard do gestor) — o usuário pediu explicitamente "do dashboard ceo".

---

## Escopo 2 — Trazer os KPIs pra página Presença

Arquivo: `src/pages/PresencaRoleta.tsx`

Adicionar um **header de KPIs fixo** logo abaixo do título (fora das abas, pra ficar visível em Hoje/Histórico/Auditoria). 4 mini-cards no mesmo padrão visual do `PresencaSummaryCard`:

```text
Corretores  |  Na empresa  |  Pendentes  |  Saíram
    27      |      17      |      0      |     3
```

Detalhes:
- Reaproveitar o hook `usePresencaCorretoresDia(scope, gestorId)` e `useRoletaPresencas()` — mesma lógica de contagem por turno ativo que o `PresencaSummaryCard` já usa.
- Subtítulo: "Turno {label} em andamento" ou "Fora do turno ativo".
- Não colocar link "Ver central de presença" (já estamos nela).
- Extrair o cálculo (contagens `naEmpresa`/`saiu`/`pendente`) pra um pequeno componente `PresencaHeaderStats` novo em `src/components/roleta/PresencaHeaderStats.tsx` — mantém a página enxuta e permite reuso.
- Manter `PresencaSummaryCard.tsx` intacto (ainda é usado por `V4PanelRoleta` no dashboard do gestor).

Layout (grid responsivo):
- Mobile (`<640px`): `grid-cols-2` (2×2).
- `sm+`: `grid-cols-4`.

---

## Escopo 3 — Auditoria e ajustes de mobile na página Presença

Vou revisar 3 partes em viewport mobile (375–420px) e corrigir o que estiver quebrado:

**a) Cabeçalho da página** (`PresencaRoleta.tsx`)
- Título + subtítulo já ok.
- Header de KPIs novo já responsivo (2 colunas em mobile).

**b) Tabs "Hoje / Histórico / Auditoria"**
- `TabsList` do shadcn já quebra bem, mas confirmar que os ícones+labels cabem em 375px. Se apertar, encolher gap e padding.

**c) Painel Hoje — `PresencaRoletaPanel.tsx`** (o principal alvo)

Ponto crítico já identificado no código atual:
- Linha 222: `grid gap-2 lg:grid-cols-[minmax(180px,220px)_1fr]` — em mobile fica uma coluna única (nome do corretor em cima, turnos embaixo). OK.
- Linha 244: chips de turno usam `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`. Em mobile fica 1 chip por linha, o que é bom pra evitar overlap dos botões "Presente/Faltou".

Ajustes que planejo aplicar quando encontrar:
- Header do grupo por equipe (nome do gestor + contagem): garantir `flex-wrap` e truncate no nome.
- Botões de ação dentro do chip (`Presente / Faltou / Sair`): em mobile forçar largura total (`w-full`) OU ícone+label curto pra não vazar.
- Aba **Histórico**: a tabela precisa de `overflow-x-auto` num wrapper e mínimos de coluna. Vou verificar linhas 200–260 e envolver em scroll horizontal se necessário.
- Aba **Auditoria**: mesma coisa — timeline/lista precisa quebrar bem em telas estreitas.
- Avatares e nomes: `truncate` + `min-w-0` onde faltar.
- `max-w-7xl mx-auto` da página + `p-6` do layout: verificar padding em mobile (talvez reduzir com `px-3 sm:px-6`).

Validação prática após o build:
- Abrir `/roleta/presenca` em 375px e 768px.
- Rolar as 3 abas.
- Testar clicar em "Presente" e abrir o dialog de horário sem overflow.
- Screenshot antes/depois de cada aba (via Playwright) — anexo no fim.

---

## O que NÃO vou mexer

- `PresencaSummaryCard.tsx` (ainda é usado pelo gestor).
- `V4PanelRoleta` (dashboard do gestor).
- Lógica de dados, RPCs, RLS — só UI/UX.
- Rotas.

---

## Entrega

- Diff das 2 mudanças (CEO dashboard, página Presença).
- Novo componente `PresencaHeaderStats.tsx`.
- Screenshots mobile das 3 abas antes/depois pra você validar.
