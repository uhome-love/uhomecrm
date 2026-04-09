

# Plano: Oferta Ativa com Tema Dinâmico (Dark/Light)

## Problema
Toda a Arena usa cores hardcoded escuras (#0A0F1E, #161B22, rgba(255,255,255,0.08), `text-white`, etc.) tanto no CSS quanto em inline styles no JSX. Quando o sistema está em modo light, a Arena continua escura.

## Solução
Converter todas as referências de cor para usar CSS variables e classes Tailwind que respondem ao tema, sem alterar nenhuma funcionalidade.

---

### Parte 1 — CSS: Trocar hardcoded por variáveis temáticas
**Arquivo:** `src/index.css`

Reescrever o bloco Arena (~linhas 600-718) usando variáveis CSS com valores light por padrão e override no `.dark`:

```css
:root {
  --arena-bg-from: #F8FAFC;
  --arena-bg-to: #F1F5F9;
  --arena-scoreboard: rgba(255,255,255,0.85);
  --arena-scoreboard-border: rgba(0,0,0,0.08);
  --arena-card-bg: #FFFFFF;
  --arena-card-border: rgba(0,0,0,0.08);
  --arena-card-hover-border: rgba(59,130,246,0.3);
  --arena-text: #1E293B;
  --arena-text-muted: #64748B;
  --arena-subtle-bg: rgba(0,0,0,0.04);
  --arena-particle-color: #3B82F6;
  --arena-floor-glow: rgba(59,130,246,0.04);
  --arena-vignette: rgba(255,255,255,0.3);
}

.dark {
  --arena-bg-from: #0A0F1E;
  --arena-bg-to: #111827;
  --arena-scoreboard: rgba(15,23,42,0.85);
  --arena-scoreboard-border: rgba(255,255,255,0.08);
  --arena-card-bg: #161B22;
  --arena-card-border: rgba(255,255,255,0.08);
  --arena-card-hover-border: rgba(59,130,246,0.4);
  --arena-text: #FFFFFF;
  --arena-text-muted: #9CA3AF;
  --arena-subtle-bg: rgba(255,255,255,0.06);
  --arena-particle-color: #60A5FA;
  --arena-floor-glow: rgba(59,130,246,0.06);
  --arena-vignette: rgba(0,0,0,0.4);
}
```

Todas as classes `.arena-*` passam a usar essas variáveis em vez de valores fixos.

### Parte 2 — JSX: Remover inline styles hardcoded
**Arquivo:** `src/pages/CorretorCall.tsx`

Substituir todos os `style={{ background: "#0A0F1E" }}`, `style={{ background: "rgba(255,255,255,0.1)" }}`, `text-white`, `text-neutral-400` por classes Tailwind temáticas:

- `style={{ background: "#0A0F1E" }}` → remover (herdado do `.arena-bg`)
- `text-white` → `text-arena` (ou `text-foreground`)
- `text-neutral-400` → `text-muted-foreground`
- `bg-white/[0.08]` → `bg-arena-subtle` (classe utilitária)
- `border-white/[0.15]` → `border-arena-border`
- Progress bar backgrounds: usar variáveis CSS

### Parte 3 — Subcomponentes
**Arquivo:** `src/components/oferta-ativa/CorretorListSelection.tsx`

Trocar referências hardcoded de cores escuras (se houver inline styles) por classes temáticas. O componente já usa `arena-card` e `arena-btn-call` que serão atualizados via CSS.

Verificar `AproveitadosPanel.tsx` e `RankingPanel.tsx` — o `darkMode` prop pode ser substituído pela detecção automática via CSS.

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/index.css` | Reescrever arena CSS com variáveis temáticas |
| `src/pages/CorretorCall.tsx` | Remover inline styles, usar classes temáticas |
| `src/components/oferta-ativa/CorretorListSelection.tsx` | Ajustar cores hardcoded se houver |

## Risco
Zero funcional. Apenas troca de valores de cor. Nenhuma lógica, handler ou query é alterada.

## Teste
- Alternar tema dark/light e verificar que a Arena adapta
- Verificar que botões verdes, progress bars e partículas mantêm qualidade visual em ambos os modos
- Verificar que cards de lista, tabs e scoreboard ficam legíveis em light mode

