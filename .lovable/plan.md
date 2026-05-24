## Alinhar "Mais ações" do drawer com menu ··· do card

### Investigação

1. **Componente:** `CardOverflowMenu` (default export, `src/components/pipeline/CardOverflowMenu.tsx`). Já implementa as 7 ações + dialogs internos (`CardScheduleVisitDialog`, `PartnershipDialog`, `PipelineTransferDialog`, `DiscardLeadDialog`).
2. **Localização do botão "Mais ações":** `src/components/pipeline/PipelineLeadDetail.tsx`, linhas 466-491 (não em `DrawerLeadInfo`). Hoje tem 4 itens próprios: Buscar imóveis, Parceria, Inativar, Apagar (CEO).
3. **Tabs:** `activeTab`/`setActiveTab` já existe; aba "tarefas" + estado `showNovaTarefa` já controlam abertura do form de nova tarefa.

### Decisão "Criar tarefa" no drawer

Opção (a): foca aba "Tarefas" **e** dispara `setShowNovaTarefa(true)` para abrir direto o form de nova tarefa (mais útil que só focar a aba). Coerente com o atalho de teclado `t` que já faz isso (linha 293).

### Mudanças

**`CardOverflowMenu.tsx`**
- Nova prop opcional `trigger?: React.ReactNode` — quando passada, substitui o botão `MoreVertical` default; envolvida em `<DropdownMenuTrigger asChild>` igual.
- Nova prop opcional `onCreateTask?: () => void` — quando passada, é chamada no clique de "Criar tarefa" em vez de `onOpenDetail()`. Card continua sem passar (default = abre drawer).
- Telemetria preservada (mesmo `pipeline_card_menu_action`).

**`PipelineLeadDetail.tsx`**
- Remove o bloco `<DropdownMenu>` (linhas 467-491) inteiro.
- Substitui por `<CardOverflowMenu lead={lead} stages={stages} onMoveLead={…} onOpenDetail={() => {}} onTransferred={…} onCreateTask={() => { setActiveTab("tarefas"); setShowNovaTarefa(true); }} trigger={<button className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border bg-card hover:bg-muted/40 text-[11px] text-muted-foreground transition-colors"><MoreHorizontal className="h-3.5 w-3.5" /> Mais ações</button>} />`.
- Remove imports não usados: `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuSeparator`, `Search`, `Ban` (se nada mais usar), e o handler `Buscar imóveis` (navigate inline já some).
- "Apagar (CEO)" estava só nesse menu — vou **preservar** como item extra no drawer (não está no spec mas é guard-rail admin). Solução: renderizar logo após o `CardOverflowMenu` como um `DropdownMenu` mínimo separado, OU adicionar inline depois. Para minimizar mudança e manter a regra "card === drawer", vou mover "Apagar (CEO)" para fora do menu, como botão pequeno destrutivo abaixo (visível só para admins). Reportar pra confirmação? Não — manter como ícone pequeno discreto ao lado de "Mais ações", já que é função admin rara.

  *Simplificação:* manter como `DropdownMenu` mínimo separado **só quando `isAdmin && onDelete`**, ao lado do "Mais ações". Não polui no caso comum.

**`CardMinimal.tsx`**
- Sem mudança — continua passando só os props originais (sem `trigger`, sem `onCreateTask`).

### NÃO toca

- Dialogs (DiscardLeadDialog etc.), telemetria, queries, lógica de moveLead, Sprint 1, Dashboard v3.
- `Buscar imóveis` página/rota — só remove o atalho do drawer.

### Aceite

- "Mais ações" abre menu com 7 itens iguais ao card.
- "Criar tarefa" foca aba Tarefas e abre form de nova tarefa.
- "Buscar imóveis" sumiu do drawer.
- Botão admin "Apagar (CEO)" preservado para isAdmin.
- Card visual inalterado.
- Build limpo.

Aguardando GO.
