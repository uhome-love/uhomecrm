## Drawer Wide v4 — Polimento Editorial

Refinamento visual do drawer v3 atual. Mantém estrutura (2 col, 3 abas, largura 70%), só polir.

### Arquivos novos
- `src/lib/leadHelpers.ts` — `getInitials(nome)` + `formatDayHeader(date)` (HOJE / ONTEM / nome do dia / "22 DE MAIO")
- `src/components/pipeline/drawer/DrawerLeadHeader.tsx` — avatar gradient 56px + iniciais + nome 20px/700 + pílulas (stage + status) + linhas de contato (📞 / ✉) com border-bottom sutil. Mantém edição inline de nome/telefone, popover de mover stage, tooltip do status.
- `src/components/pipeline/drawer/DrawerTimelineGroup.tsx` — cabeçalho do dia ("HOJE") com linha divisória, e item de evento com ícone em círculo 36px com bg sutil por tipo, linha conectora vertical entre eventos do mesmo grupo, título / descrição / hora.

### Arquivos editados
- `PipelineLeadDetail.tsx` — substituir bloco "Row 1/2" do header pelo novo `DrawerLeadHeader`. Manter `DrawerProximaAcao` (já existe), `DrawerActionGrid` 2x2 (já existe), `DrawerEmpreendimento` (passar a renderizar empreendimento+meta no topo + grid de 3 métricas — pequena melhoria visual interna). Adicionar label "AÇÕES" cinza antes do grid. Adicionar botão "··· Mais ações" full-width sob o grid (atalho equivalente ao ⋯ atual, sem remover o atual). Remover "Row 2.5" duplicada (combobox empreendimento — mover edição para clique no card empreendimento).
- `DrawerEmpreendimento.tsx` — refazer visual: header com ícone+nome+meta_ads no topo + divider + grid 3 métricas (tentativas/dias na etapa/últ. contato), aceitar `meta` prop.
- `LeadHistoricoTab.tsx` — substituir loop atual da timeline por agrupamento por dia usando `DrawerTimelineGroup` + `DrawerTimelineEventItem`. Manter delete/notas/form de atividade ocultos como já estão.

### Não tocar
Layout 2 col, abas, largura, Sprint 1, Dashboard v3, queries, telemetria, lógica de filtros, `useCorretorKpisCarteira`.

### Cores por tipo (timeline circle bg)
- ligacao/call/nao_atendeu → `bg-red-50 text-red-600`
- whatsapp/mensagem → `bg-indigo-50 text-indigo-600`
- tarefa concluída / entrada / aceito → `bg-emerald-50 text-emerald-600`
- nota/anotacao → `bg-amber-50 text-amber-600`
- visita → `bg-sky-50 text-sky-600`
- historico/move → `bg-violet-50 text-violet-600`
- fallback → `bg-zinc-100 text-zinc-600`

### Critérios de aceite (alinhados ao prompt)
- Avatar gradient indigo→roxo com iniciais
- Nome 20px/700 tracking-tight
- Pílulas stage + status em linha
- Contato em rows separadas com ícone
- Caixa PRÓXIMA AÇÃO gradient (já existe)
- Grid 2x2 puro (já existe) + label "AÇÕES" + botão Mais ações
- Empreendimento polido (header + 3 métricas)
- Timeline agrupada por dia com ícones em círculo e linha conectora
- Build limpo, Sprint 1 / Dashboard v3 intactos
