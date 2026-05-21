## Status

**Fix 3 já está executado** (confirmado nesta rodada e nas anteriores). Estado atual do Modo Foco:

- Painel esquerdo: só **"Descartar Lead"** (compacto, vermelho) — Avançar Etapa foi removido em R3.7 (fluxo migrou para TaskCompletionDialog Tela 2). Avançar próximo lead foi consolidado no top strip.
- Top strip linha 2: **Concluir tarefa** (CTA gradient) · **Ligar** (popover) · **WhatsApp** (verde) · **Próximo →** (discreto, `bg-white/10 border-white/20`).
- Cenário (a) confirmado, não (b). Não há lógica por lead que esconda Avançar Etapa — ele simplesmente não existe mais.

Logo, **passos 1-3 do roteiro já estão prontos**. Resta apenas o item 3 ADICIONAL (loading polido).

---

## Plano — Loading Skeleton

### Arquivos

1. **Novo:** `src/components/pipeline/focus/FocusLoadingSkeleton.tsx`
2. **Editar:** `src/components/pipeline/FocusModeModal.tsx` (linhas 584-588)

### `FocusLoadingSkeleton.tsx`

Componente sem props que reproduz o layout real do `LeadFocusScreen` em skeletons pulsantes:

- **Top strip** (rounded-2xl com mesmo gradient sutil indigo/violet):
  - bloco "Trabalhados" (avatar redondo + 2 linhas)
  - divider
  - bloco "Próxima ação" (label + linha de título)
  - linha 2: 4 retângulos de altura `h-12` (CTA largo + 3 botões fixos) simulando Concluir / Ligar / WhatsApp / Próximo
- **Grid 3/7** abaixo:
  - **Coluna esquerda (lg:col-span-3):** card único `rounded-2xl` com 4 sub-blocos pulsantes empilhados (LeadHeader, HomiInsight, PendingTasks, Scripts)
  - **Coluna direita (lg:col-span-7):** card `rounded-2xl` com header (título + subtítulo) + 5-6 linhas de "evento" (avatar circular + 2 linhas de texto), respeitando contraste do escopo `dark`
- Usa `animate-pulse` do Tailwind, cores `bg-white/5` / `bg-white/10` para casar com fundo dark do modal
- Mesmas dimensões/spacing do conteúdo real → zero "jump" quando dados chegam
- Tokens semânticos (sem hex direto), comentário no topo registrando regra de contraste do Modo Foco

### Edit em `FocusModeModal.tsx` (linhas 584-588)

Trocar:
```tsx
) : loading ? (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    <span className="text-gray-400 text-sm">Buscando leads que precisam de atenção...</span>
  </div>
```

Por:
```tsx
) : loading ? (
  <FocusLoadingSkeleton />
```

Header (linhas ~540-570: contador "Modo Foco N/M" + progress bar) **fica como está** — já renderiza antes do bloco condicional, então aparece imediatamente. ✅ Atende item C.

Texto "Preparando sua sessão de foco..." (item B) entra como subtítulo discreto **opcional** no topo do skeleton (`text-xs text-foreground/60`), ou removido — opto por incluir uma única vez acima do top strip skeleton para manter contexto sem ruído.

### Preservado intacto

- `useFocusLeads`, telemetria `focus_mode_opened`, cache HOMI, BRT, escopo `dark` do `DialogContent`, todos os 4 fixes cirúrgicos de contraste, fluxo Descartar inline, TaskCompletionDialog.

### Validação

- Abrir Modo Foco → confirmar skeleton aparece imediatamente com mesma estrutura do conteúdo final
- Confirmar transição suave (sem flash branco/jump de layout)
- Screenshot do skeleton + screenshot do estado carregado para comparação

### Estimativa
~30-40 min (componente novo enxuto + 1 edit pontual).

Aguardando OK para executar.
