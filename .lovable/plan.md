

# Plano: Tema Dinâmico em TODOS os Componentes da Oferta Ativa

## Problema
As variáveis CSS arena foram criadas no `index.css`, mas **8 componentes** dentro de `src/components/oferta-ativa/` ainda têm 168+ referências inline hardcoded a cores escuras (`#0A0F1E`, `#161B22`, `#1C2128`, `color: "white"`, etc.). A tela de seleção de listas ficou temática, mas ao entrar na Arena (ligação), tudo volta a ser escuro fixo.

## Arquivos Afetados (8 componentes)

| Arquivo | Refs hardcoded |
|---------|---------------|
| `DialingModeWithScript.tsx` | ~40 (background principal, tabs, ficha rápida, mobile tabs) |
| `AttemptModal.tsx` | ~20 (dialog, cards de resultado, textarea, botão) |
| `CustomListAttemptModal.tsx` | ~25 (idêntico ao AttemptModal + próxima ação) |
| `AproveitadosPanel.tsx` | ~20 (background, cards, textos, filtros) |
| `RankingPanel.tsx` | ~20 (background, cards, badges) |
| `ScriptPanel.tsx` | ~15 (cards, tabs, texto) |
| `FichaRapida.tsx` | ~10 (inputs, notas pessoais) |
| `HomiObjectionHelper.tsx` | ~10 (dialog, labels) |
| `ArenaSessionSummary.tsx` | ~8 (background, cards) |

## Solução

Substituir **todos** os `style={{ background: "#0A0F1E" }}`, `style={{ color: "white" }}`, etc. por referências às variáveis CSS já definidas no `index.css`:

**Mapeamento de cores:**
- `#0A0F1E` / `#111827` → `var(--arena-bg-from)` ou classe `arena-bg`
- `#161B22` / `#1C2128` → `var(--arena-card-bg)` ou classe `arena-card`
- `rgba(255,255,255,0.08)` / `0.1` / `0.12` / `0.15` → `var(--arena-card-border)`
- `color: "white"` / `#E5E7EB` / `#E2E8F0` → `var(--arena-text)` ou `text-foreground`
- `color: "#6B7280"` / `#94A3B8` / `#64748B` → `var(--arena-text-muted)` ou `text-muted-foreground`
- `#4ADE80` / `#22C55E` → mantém (verde semântico, igual em ambos os temas)

**Abordagem por componente:**

1. **DialingModeWithScript** — remover `style={{ background: "#0A0F1E" }}` do container raiz (herda de `arena-bg`), trocar tabs e ficha rápida para usar `var(--arena-card-bg)`
2. **AttemptModal + CustomListAttemptModal** — DialogContent usa `bg-card` e `border` padrão do shadcn, cards de resultado usam `var(--arena-card-bg)`, textarea usa `bg-input`
3. **AproveitadosPanel** — trocar backgrounds e cores de texto para variáveis arena
4. **RankingPanel** — remover o objeto `dk` de dark mode e usar variáveis CSS direto (funciona automaticamente)
5. **ScriptPanel** — já usa prop `darkMode` condicionalmente; trocar para variáveis CSS sempre
6. **FichaRapida** — inputs e notas pessoais usam variáveis arena
7. **HomiObjectionHelper** — dialog usa `bg-card` padrão
8. **ArenaSessionSummary** — container usa `arena-bg`

## Resultado
- Sistema em light mode → Arena inteira em tons claros
- Sistema em dark mode → Arena inteira em tons escuros
- Zero mudança funcional — apenas troca de valores de cor

## Risco
Zero funcional. Alto volume de substituições (168+), mas todas mecânicas (trocar valor fixo por variável CSS).

