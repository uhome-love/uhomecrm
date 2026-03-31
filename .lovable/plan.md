

# Central de Nutrição — Página Unificada

## Situação Atual

A nutrição está fragmentada em 4 lugares diferentes:
- `/automacoes` → Automações + SequenceTemplates + NurturingDashboard (misturado)
- `/campanhas-voz` → Campanhas de voz IA (página separada)
- `/disparador-ligacoes-ia` → Discagem IA individual (página separada)
- `/email-marketing` → Email marketing (página separada)

O CEO precisa navegar entre 4 rotas para ter visão completa da nutrição.

## Solução

Criar uma **página unificada `/central-nutricao`** com 5 abas organizadas:

```text
┌──────────────────────────────────────────────────────┐
│  Central de Nutrição                                 │
│  Orquestração multicanal inteligente                 │
├──────┬──────────┬──────────┬──────────┬──────────────┤
│ Visão│ Sequên-  │ Campanhas│ Disparo  │ Automações   │
│ Geral│ cias     │ de Voz   │ Email    │              │
└──────┴──────────┴──────────┴──────────┴──────────────┘
```

### Aba 1 — Visão Geral (Dashboard de Performance)
- KPIs consolidados: leads em nutrição, score médio, hot leads, taxa de resposta
- Performance por canal (WhatsApp / Email / Voz) com métricas lado a lado
- Hot leads (score ≥ 15) com ação rápida
- Reativação: tentados vs reativados (30d)
- Últimos disparos (log unificado de todos os canais)
- Botão pausar/retomar global

### Aba 2 — Sequências
- Conteúdo do `SequenceTemplates` (templates de cadência)
- Stats por etapa do funil (sem_contato, qualificação, reativação)
- Ativar/desativar sequências

### Aba 3 — Campanhas de Voz
- Conteúdo completo do `CampanhasVozPage` (criar, monitorar, histórico)
- Integrado na mesma página sem navegação extra

### Aba 4 — Email Marketing
- Conteúdo do `EmailMarketingPage` movido para componente reutilizável
- Campanhas de email, templates, histórico

### Aba 5 — Automações
- Conteúdo das automações custom (wizard, lista, logs)
- Manter possibilidade de criar automações personalizadas

## Implementação Técnica

1. **Criar `src/pages/CentralNutricaoPage.tsx`** — Página principal com Tabs e lazy loading de cada aba

2. **Refatorar componentes existentes** — Extrair o conteúdo interno de `AutomacoesPage`, `CampanhasVozPage` e `EmailMarketingPage` em componentes reutilizáveis (ex: `AutomacoesContent`, `CampanhasVozContent`, `EmailMarketingContent`) para renderizar dentro das abas

3. **Criar `src/components/central-nutricao/NutricaoVisaoGeral.tsx`** — Dashboard consolidado que une os dados do `NurturingDashboard` com métricas globais de todos os canais

4. **Atualizar rota em `App.tsx`** — Adicionar `/central-nutricao` protegida para admin

5. **Atualizar Sidebars** — Substituir os 4 links separados por um único "Central de Nutrição" no grupo de Marketing/Automação

6. **Manter rotas antigas** como redirect para `/central-nutricao` (não quebrar bookmarks)

