## Plano de correção — Bugs PDN reportados ao vivo

### Problemas validados
1. **Drawer troca de aba sozinho**: `PdnLeadDrawer.tsx` reseta o estado `tab` sempre que o objeto `row` é recriado (a cada refresh de dados). Como `usePdnLive` dispara refresh frequentemente, o usuário não consegue manter a aba selecionada.
2. **Drawer abre sozinho ao editar observação na planilha**: `ObsSelector` fecha o popover e dispara `onSave`, que chama `loadEntries()`. Durante o fechamento, o evento pode vazar para a `TableRow` e abrir o drawer.
3. **Tela atualizando a cada ~2 segundos**: `usePdnLive.ts` usa debounce de 800ms e assina `UPDATE` em `pipeline_leads`. Em ambientes com muitos updates em background, isso provoca flicker constante.

### Correções propostas

#### 1. Estabilizar o drawer contra atualizações de dados
**Arquivo:** `src/components/pdn/drawer/PdnLeadDrawer.tsx`
- Trocar a dependência do `useEffect` de `row` (objeto) para `row?.id` (string).
- Assim o estado interno (incluindo `tab`, observação, etc.) só reseta quando o lead realmente mudar, não quando os dados do mesmo lead forem atualizados.

#### 2. Reduzir a frequência do realtime no PDN
**Arquivo:** `src/hooks/pdn/usePdnLive.ts`
- Aumentar o debounce de 800ms para 3000ms.
- Adicionar um cooldown/throttle de 5 segundos entre refreshes, para evitar que uma rajada de updates em background deixe a UI piscando.
- Manter a assinatura em `pipeline_leads` e `visita_eventos` (fonte de verdade).

#### 3. Evitar que edição inline abra o drawer acidentalmente
**Arquivo:** `src/pages/PdnGestor.tsx`
- Em `ObsSelector`: adicionar `e.stopPropagation()` nos botões "Salvar" e "Salvar e publicar", e no `PopoverTrigger`.
- Em `StatusSelector`: adicionar `e.stopPropagation()` nos botões de status e no trigger.
- Em `EditableWrapCell`: adicionar `e.stopPropagation()` no botão de salvar.
- Garantir que `handleRowClick` continue respeitando `[data-no-row-open]` (já existe).

### Validação
- Testar no preview com Playwright: abrir drawer, trocar de aba, esperar 10s e confirmar que a aba não muda.
- Editar observação na planilha, salvar, e confirmar que o drawer não abre sozinho.
- Monitorar a quantidade de refreshes em 10s de espera na página (deve ser no máximo 1 refresh a cada 5s).

### Escopo
Apenas ajustes de UX/eventos no PDN. Sem mudanças de schema, migration ou regra de negócio.