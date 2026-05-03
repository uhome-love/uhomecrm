## Objetivo

Unificar as 3 páginas redundantes em **uma única Central de Relatórios** (`/central-relatorios`), mantendo todas as funcionalidades: dashboard executivo (semanal/mensal), relatórios temáticos por tab e relatórios 1:1 por corretor (com IA). CEO vê tudo da empresa; Gerente vê tudo da própria equipe; Corretor mantém acesso ao próprio "Relatório Semanal" via tab restrita.

## Estado atual (3 páginas)

| Rota | Página | Função |
|---|---|---|
| `/central-relatorios` | `ReportCenter.tsx` | Tabs temáticas (Vendas, Leads, Visitas, Negócios, OA, Conversão, Empreendimentos, Origem, Interação, Tarefas, Mega) com filtros + export PDF |
| `/relatorio-semanal` | `RelatorioSemanal.tsx` | Dashboard executivo: 10 KPIs, comparativos, gráficos, drilldown por corretor/equipe |
| `/relatorios` | `RelatorioCorretor.tsx` | Relatórios 1:1 com IA por corretor — geração manual + auto, histórico salvo |

## Estrutura nova (uma página)

`/central-relatorios` vira a **Central** com 3 grupos de tabs no topo:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Central de Relatórios                          [Exportar PDF ▾] │
│                                                                  │
│  ┌─ Visão ─────────────────┐ ┌─ Área ──────┐                    │
│  │ Executivo  Temáticos  1:1│ │ Empresa │ Equipe │ Eu           │
│  └─────────────────────────┘ └─────────────┘                    │
│                                                                  │
│  [Filtros: Período · Equipe · Corretor · Segmento]              │
│                                                                  │
│  Conteúdo da visão ativa                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Visão "Executivo"
Conteúdo de `RelatorioSemanal` (KPIs, gráficos, drilldown). Default para todos.

### Visão "Temáticos"
Sub-tabs atuais do `ReportCenter`: Vendas / Leads / Negócios / Oferta Ativa / Conversão / Empreendimentos / Origem / Interação / Visitas / Tarefas / ✦ Mega.

### Visão "1:1 Corretor"
Conteúdo de `RelatorioCorretor` (geração manual + auto + histórico, com IA).

### Filtro "Área" (escopo)
- **Empresa** (admin/CEO): todos os corretores e equipes
- **Equipe** (gestor padrão; admin pode escolher uma equipe): apenas a equipe selecionada
- **Eu** (corretor): apenas próprios dados (visível só na visão Executivo, único acesso para corretor)

Permissões:
- Admin/CEO: tudo, default Empresa.
- Gestor: tudo, default Equipe (sua), pode trocar entre equipes que gerencia (na prática só a dele).
- Corretor: somente Visão "Executivo" + Área "Eu" (preserva o atual `/relatorio-semanal` do corretor). Outras visões ficam ocultas.

## Arquivos

**Refatorar:**
- `src/pages/ReportCenter.tsx` — reescrever para hospedar as 3 visões com seletor de visão e área. Reaproveita componentes existentes em `src/components/relatorios/*` e `src/components/relatorio/*`.

**Mover lógica para componentes (sem perder código):**
- Criar `src/components/relatorios/ExecutivoView.tsx` — extrai o corpo de `RelatorioSemanal.tsx` (KPIs, gráficos, drilldown) recebendo `{ scope: 'empresa' | 'equipe' | 'eu', equipeId?, corretorId?, period }` em vez de gerenciar URL.
- Criar `src/components/relatorios/UmAUmView.tsx` — extrai o corpo de `RelatorioCorretor.tsx` (geração 1:1 manual + auto + histórico) recebendo escopo de equipe.
- Criar `src/components/relatorios/TematicosView.tsx` — encapsula o switch de tabs temáticas atual (Vendas, Leads, etc.).

**Manter compatibilidade de rotas (redirects):**
- `/relatorio-semanal` → `/central-relatorios?visao=executivo`
- `/relatorios` → `/central-relatorios?visao=1a1`
- Implementado via componente `<Navigate replace>` registrado no `pageRegistry.ts` ou rota dedicada em `App.tsx`. (Conforme regra do projeto: redirect-first para legacy paths.)

**Sidebar (`src/components/layout/Sidebar.tsx`):**
- Remover entradas duplicadas: "Relatório semanal" (linha 52), "Relatórios 1:1" (linhas 81 e 148).
- Manter somente **"Central Relatórios"** apontando para `/central-relatorios` (uma para cada role).
- Para corretor: substituir "Relatório semanal" por "Meu relatório" → `/central-relatorios?visao=executivo&area=eu`.

**Page Registry (`src/config/pageRegistry.ts`):**
- Remover `relatorios` e `relatorio-semanal` das definições de rota; deixar apenas `report-center` em `/central-relatorios`.
- Adicionar `roles: ["admin","gestor","corretor"]` para permitir corretor (acesso restrito por área dentro da página).
- Adicionar redirect entries para os paths antigos.

**Atualizar referências externas:**
- `src/pages/CeoDashboard.tsx:891` — trocar `navigate("/relatorio-semanal")` por `navigate("/central-relatorios?visao=executivo")`.

**Deletar arquivos antigos** (somente após confirmar zero referências):
- `src/pages/RelatorioSemanal.tsx`
- `src/pages/RelatorioCorretor.tsx`

## Detalhes técnicos

- Estado da Central via `useSearchParams`: `?visao=executivo|tematicos|1a1&area=empresa|equipe|eu&tab=...&periodo=...&de=...&ate=...&equipe=...&corretor=...&segmento=...`. Permite link compartilhável.
- Os componentes `RelatorioSemanal` e `RelatorioCorretor` hoje gerenciam seu próprio estado de período/escopo internamente — ao extrair em `ExecutivoView` e `UmAUmView`, expor props para receber filtros do pai e fazer fallback para os internos quando ausentes (não quebrar lógica existente).
- Export PDF (lógica já existente no `ReportCenter`) generaliza-se: cada view expõe um id raiz (`#exec-content`, `#tematicos-content`, `#um-a-um-content`) e o handler decide qual capturar conforme a visão ativa.
- BRT timezone preservado (regra do projeto), cálculos vindos de `useRelatorioExecutivo` continuam idênticos.
- Não tocar nas Edge Functions de geração de relatórios IA.

## Validação

- CEO entra em `/central-relatorios` → vê Executivo da Empresa por padrão; consegue alternar para Temáticos e 1:1.
- Gerente vê tudo, mas sempre escopado à própria equipe.
- Corretor entra → só vê visão Executivo · Eu; outras tabs ocultas.
- URLs antigas `/relatorio-semanal` e `/relatorios` redirecionam preservando intenção.
- Botão Exportar PDF funciona em todas as 3 visões.
