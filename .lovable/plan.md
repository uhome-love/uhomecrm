

# Plano: Design System Pipedrive/Pipefy — Pipeline de Leads

## Escopo

Converter ~150 referências de cor hardcoded nos componentes do Pipeline para usar CSS variables e classes Tailwind, aplicando a paleta Pipedrive-style especificada, com suporte completo a dark/light mode.

## Arquivos Modificados

| Arquivo | Mudanças |
|---------|----------|
| `src/index.css` | Adicionar variáveis CSS de stage colors e pipeline-specific tokens |
| `src/components/pipeline/PipelineBoard.tsx` | Substituir todos inline styles de cor por classes Tailwind/CSS vars |
| `src/components/pipeline/PipelineCard.tsx` | Substituir ~60 cores hardcoded por CSS vars temáticas |
| `src/components/pipeline/CardActionBar.tsx` | Substituir inline styles de cor por classes Tailwind |
| `src/components/pipeline/CardStatusLine.tsx` | Usar CSS vars em vez de hex fixo |

## Detalhes Técnicos

### 1. Novas CSS Variables (`src/index.css`)

Adicionar ao `:root` e `.dark`:

```
/* Pipeline Stage Colors */
--stage-novo-lead: 217 91% 60%;
--stage-sem-contato: 38 92% 50%;
--stage-contato: 239 84% 67%;
--stage-qualificacao: 258 90% 66%;
--stage-possivel-visita: 330 81% 60%;
--stage-visita-marcada: 160 84% 39%;
--stage-visita-realizada: 189 94% 43%;
--stage-em-evolucao: 25 95% 53%;
--stage-negocio-criado: 142 71% 45%;
--stage-descarte: 220 9% 46%;

/* Pipeline Card tokens */
--pipeline-card-bg: 0 0% 100%;
--pipeline-card-border: 214 32% 91%;
--pipeline-card-border-hover: 213 94% 68%;
--pipeline-card-shadow: 0 1px 3px rgba(0,0,0,0.05);
--pipeline-card-shadow-hover: 0 6px 20px rgba(37,99,235,0.10);
--pipeline-text-primary: 222 47% 11%;
--pipeline-text-secondary: 215 14% 44%;
--pipeline-text-muted: 215 16% 57%;
--pipeline-column-bg: 0 0% 100%;
--pipeline-column-border: 214 32% 91%;
--pipeline-tab-bg: 210 40% 98%;
--pipeline-tab-active-bg: 0 0% 100%;
--pipeline-empty-icon-bg: rgba(79,70,229,0.1);
```

Dark mode equivalents:
```
--pipeline-card-bg: 218 35% 13%;
--pipeline-card-border: 218 30% 20%;
--pipeline-text-primary: 210 40% 96%;
--pipeline-text-secondary: 215 20% 65%;
--pipeline-column-bg: 218 35% 11%;
etc.
```

### 2. PipelineBoard.tsx — Substituições Principais

- `background: "#fff"` → `hsl(var(--pipeline-column-bg))`
- `border: "1px solid #e8e8f0"` → `hsl(var(--pipeline-column-border))`
- `color: "#0a0a0a"` → `hsl(var(--pipeline-text-primary))`
- `color: "#52525b"` → `hsl(var(--pipeline-text-secondary))`
- `color: "#a1a1aa"` → `hsl(var(--pipeline-text-muted))`
- `background: "#f7f7fb"` → `hsl(var(--pipeline-tab-bg))`
- `STAGE_THEMES` object → usar as novas variáveis de stage
- Tabs mini-map: usar CSS vars para bg/border/text
- Empty state: usar CSS vars

### 3. PipelineCard.tsx — Substituições Principais

- Card container: `background`, `border`, `boxShadow` → CSS vars
- `color: "#0a0a0a"` (nome) → `hsl(var(--pipeline-text-primary))`
- `color: "#4F46E5"` (corretor) → mantém (brand accent, funciona em ambos modos)
- `background: "#f7f7fb"` (empreendimento tag) → `hsl(var(--muted))`
- `border: "1px solid #e8e8f0"` → `hsl(var(--border))`
- `color: "#94A3B8"` (telefone) → `hsl(var(--muted-foreground))`
- `color: "#52525b"` → `hsl(var(--pipeline-text-secondary))`
- Hover handlers: usar CSS vars em vez de hex
- NegocioCriadoSection: `background: "#F5F3FF"` → `hsl(var(--purple-50))`
- Regression buttons: usar CSS vars

### 4. CardActionBar.tsx

- `color: "#4F46E5"` (Ligar) → mantém
- `color: "#16a34a"` (WhatsApp) → mantém
- `color: "#888780"` (menu) → `hsl(var(--muted-foreground))`
- Hover backgrounds: usar CSS vars
- `borderTop` / `borderRight`: usar `hsl(var(--border))`

### 5. CardStatusLine.tsx

- `#DC2626` → `hsl(var(--danger-500))`
- `#D97706` → `hsl(var(--warning-500))`
- `#059669` → `hsl(var(--success-500))`

### 6. Animações e Transições

Manter os keyframes existentes. Ajustar:
- `--transition-fast: 120ms ease`
- Card hover: `translateY(-1px)` + shadow via CSS var
- Drag: `scale(1.02)` + shadow forte
- Column flash: mantém com `--flash-color`

## Paleta de Stage Colors (conforme especificado)

| Etapa | Cor |
|-------|-----|
| Novo Lead | `#3B82F6` Blue |
| Sem Contato | `#F59E0B` Amber |
| Contato Iniciado | `#6366F1` Indigo |
| Qualificação | `#8B5CF6` Violet |
| Possível Visita | `#EC4899` Pink |
| Visita Marcada | `#10B981` Emerald |
| Visita Realizada | `#06B6D4` Cyan |
| Em Evolução | `#F97316` Orange |
| Negócio Criado | `#22C55E` Green |
| Descarte | `#6B7280` Gray |

## Card Dimensions (Pipedrive-style)

- `--column-width: 280px` (atual 268 → ajustar)
- `--card-padding: 12px`
- `--card-gap: 8px`
- `--card-radius: 8px` (atual 14 → reduzir para mais profissional)
- `--column-gap: 12px`

## Risco
Zero funcional. Apenas substituição de valores de cor e espaçamento. Nenhuma lógica, handler, query ou fluxo de negócio é alterado. Volume alto (~150 substituições) mas todas mecânicas.

## Teste
- Alternar dark/light e verificar que todas as colunas, cards, tabs e badges adaptam
- Verificar legibilidade de texto em ambos os modos
- Verificar que drag & drop funciona normalmente
- Verificar que hover states são visíveis em ambos os modos
- Verificar que stage colors estão corretas nas barras de progresso e headers

