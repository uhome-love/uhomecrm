# Central de Roleta — Redesign completo

Transformar a página `/roleta` numa central operacional de distribuição de leads: mais inteligente, organizada e completa, sem perder nenhuma função existente. Mesma abordagem do redesign do pipeline.

## Diagnóstico atual

- `RoletaLeads.tsx` tem 705 linhas com `CeoView` + `CorretorView` no mesmo arquivo.
- **9 abas planas** no header (Gestão, Métricas, Leads gerados, Histórico, Leads perdidos, Entradas WhatsApp, Bloqueados, Inteligência, Configurações) — visualmente "embolado", sem hierarquia.
- Sem um painel de status sempre visível: janela ativa, countdown, credenciados, fila CEO e taxa de aceite ficam escondidos dentro de abas.
- Página **`/disponibilidade`** ("Motor de Distribuição") existe órfã, fora do sidebar, com Pendentes e Performance que deveriam morar na roleta.
- Cores hardcoded (`#4969FF`, `#f0f0f5`) em vez de tokens semânticos.

## Proposta visual e estrutural

```text
┌─────────────────────────────────────────────────────────────┐
│  🎯 Central de Roleta          [Incluir]  [Atualizar]        │
│  Janela: Tarde 🌞 · próxima transição 02:14:30               │
├─────────────────────────────────────────────────────────────┤
│  STATUS BAR (sempre visível — KPIs ao vivo)                  │
│  [Credenciados 12] [Fila CEO 3] [Aguard. aceite 5]           │
│  [Distribuídos hoje 47] [Taxa aceite 82%] [Pendentes 2]      │
├─────────────────────────────────────────────────────────────┤
│  Abas agrupadas:                                             │
│   OPERAÇÃO   |   LEADS   |   INTELIGÊNCIA   |   CONFIG        │
│  Operação ▸ Roleta ao vivo · Credenciamentos · Pendentes ·   │
│            Bloqueados                                         │
│  Leads    ▸ Gerados · Histórico · Perdidos · WhatsApp        │
│  Intelig. ▸ Métricas · Inteligência (IA)                     │
│  Config   ▸ Parâmetros · Segmentos/Campanhas · Performance   │
└─────────────────────────────────────────────────────────────┘
```

### 1. Header de comando + Status Bar ao vivo
- Barra de KPIs sempre visível acima das abas (credenciados ativos, fila CEO, aguardando aceite, distribuídos hoje, taxa de aceite, credenciamentos pendentes), com realtime.
- Janela ativa + countdown movidos para o topo, sempre presentes.
- Ações primárias (Incluir na roleta / Atualizar) no header.

### 2. Reorganização das 9 abas em 4 grupos lógicos
- **Operação**: roleta ativa por segmento (board atual) + credenciamentos pendentes + leads pendentes (da `/disponibilidade`) + corretores bloqueados.
- **Leads**: gerados, histórico (roletagens), perdidos, entradas WhatsApp.
- **Inteligência**: métricas + inteligência IA.
- **Config**: parâmetros, segmentos/campanhas + dashboard de performance de distribuição (da `/disponibilidade`).
- Navegação em dois níveis: grupo (segmented control) → sub-aba.

### 3. Absorver funções órfãs de `/disponibilidade`
- Trazer `PendingLeadsPanel` e `DistributionDashboard` para dentro da central (sem perder nada).
- `/disponibilidade` passa a **redirecionar** para `/roleta` (mantém compatibilidade de links antigos).

### 4. Melhorias de qualidade
- Substituir cores hardcoded por tokens semânticos (theme-safe, dark mode).
- Estados vazios/loading consistentes e responsivos.
- Mobile: status bar vira carrossel/grid compacto; abas com scroll horizontal.
- `CorretorView` (credenciamento do corretor) preservada integralmente.

### 5. Refatoração de arquitetura (regra >500 linhas)
- Quebrar `RoletaLeads.tsx` em:
  - `RoletaLeads.tsx` (shell + roteamento admin/corretor)
  - `roleta/ceo/CentralRoletaCeo.tsx` (header + status bar + navegação)
  - `roleta/ceo/RoletaStatusBar.tsx`
  - `roleta/ceo/RoletaOperacaoTab.tsx` (board ao vivo + credenciamentos + incluir modal)
  - `roleta/corretor/RoletaCorretorView.tsx`
- Abas existentes (Métricas, LeadsGerados, etc.) reaproveitadas como estão.

## Detalhes técnicos

- **Sem mudanças de banco/RLS/edge functions** — apenas reorganização de frontend e consumo dos hooks/queries que já existem (`useRoleta`, `useLeadIntelligence`, queries de métricas).
- Status bar reusa as queries já presentes em `RoletaMetricasTab` (extraídas para um hook `useRoletaStatus` compartilhado para evitar duplicação).
- `pageRegistry.ts`: `disponibilidade` vira redirect para `/roleta`; remover do sidebar se aplicável (já não está visível).
- Tokens: adicionar/usar variáveis semânticas em vez de `#4969FF`/`#f0f0f5`.
- Sem novas dependências.

## Escopo preservado (nada se perde)
Credenciamento de corretor, aprovação/recusa/aprovar-todos, board por segmento, remover da fila, incluir manual, leads acumulados madrugada, elegibilidade noturna/domingo, todas as 9 abas, realtime.

## Ponto a confirmar
Absorver `/disponibilidade` (Pendentes + Performance) para dentro da central e redirecionar a rota antiga — incluído no plano. Se preferir manter `/disponibilidade` separada, removo esse item.