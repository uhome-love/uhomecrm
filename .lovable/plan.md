

# Plano Unificado: Redesign Visual + Nova Cor #4969FF

## O que será feito

Redesign completo do CRM com visual moderno e profissional, usando **#4969FF** como cor de destaque, aplicado consistentemente em todas as páginas.

## Alterações

### 1. Nova paleta de cores em `src/index.css`
Substituir toda a escala `--primary-*` (de `#3B82F6` para `#4969FF`), atualizar `--brand-medium`, e refinar o dark mode com fundos mais profundos e contrastantes.

### 2. Substituir cores hardcoded em ~80 arquivos
Trocar todas as ocorrências de `#4F46E5` e `#3B82F6` por `#4969FF` ou pelo token CSS `hsl(var(--primary-500))` nos componentes. Arquivos principais:
- `UhomeLogo.tsx` — cor do texto "Sales" e ícones Homi
- `GlobalDateFilterBar.tsx` — tabs ativas
- `PageHeader.tsx` — ícone e tabs
- `CorretorDashboard.tsx` — gradientes do header
- `PipelineCard.tsx` — badges e labels
- `CampaignHeader.tsx` — gradiente de fundo
- `Auth.tsx` — loader e gradientes
- `TabEmpresa.tsx`, `CeoDashboard.tsx`, `HomiAssistant.tsx`, `WhatsAppFocusFlow.tsx`, `RadarImoveisTab.tsx`, etc.

### 3. Visual moderno global
- Cards: border-radius 12-16px, sombras mais suaves, padding maior
- Tipografia: valores de KPI maiores, labels mais leves
- Espaçamento mais generoso entre seções
- Botões de ação mais arredondados e limpos
- Superfícies: fundo off-white com cards brancos puros (light) / deep-slate com cards escuros (dark)

### 4. Dark mode refinado
- Background principal: `#0A0E1A`
- Cards: `#12162A`
- Sidebar: tom mais profundo
- Melhor contraste com o novo indigo `#4969FF`

## Resultado esperado
- Visual sofisticado e profissional (menos "infantil")
- Cor UHome `#4969FF` como destaque único em todo o sistema
- Consistência total entre páginas e modos claro/escuro
- Nenhuma funcionalidade alterada — apenas aparência

