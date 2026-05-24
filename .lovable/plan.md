# Plano — Fechamento Pipeline v2

Última sprint. Header polish + Drawer wide v3 (split 2 colunas).

## Decisões abertas resolvidas

1. **Anotar persistência:** reusa pipeline já existente. `LeadHistoricoTab` já tem `onAddAnotacao(conteudo)` plumado em `PipelineLeadDetail.tsx:723`. Vai pra tabela `pipeline_anotacoes` (separada de `pipeline_atividades`). O novo `DrawerAnotarDialog` apenas chama essa mesma função.
2. **Empreendimento métricas:** já temos `lead.tentativas_contato`, dias na etapa via `pipeline_atividades` (movimentações) e último contato via `lead.ultima_atualizacao` / atividades. Render condicional — esconde coluna que não tiver dado.
3. **Timeline:** reusar `src/components/pipeline/focus/TimelineEventItem.tsx` + `TimelineSection.tsx` + hook `useTimelineEvents`. Não duplicar.

## Fase 1 — Header polish (PipelineHeader.tsx)

- Linha 1: ícone+título · pílulas (PipelineFiltroBadges inline) · spacer · ações (campanhas, filtros, busca, ordenar, foco, novo lead)
- Linha 2: só tabs Kanban/Inteligência
- Linha 3 condicional: chip de filtro ativo (só renderiza se `filtroAtivo !== "todos"`)
- Responsivo: `flex-wrap` permite pílulas caírem em < 1200px

## Fase 2 — Drawer largura

`PipelineLeadDetail.tsx` SheetContent: `sm:w-[70vw] sm:max-w-[2000px]`. Remove o teto 1100px.

## Fase 3 — Split 2 colunas (estrutural)

Criar pasta `src/components/pipeline/drawer/`:

- **`DrawerLeadInfo.tsx`** (col esquerda 36%, bg `#fafafa`)
  - Header lead (nome 22px + 2 pílulas status)
  - Contato (telefone + email)
  - Caixa "Próxima Ação" (gradient indigo/purple, border indigo/18)
  - `<DrawerActionGrid />`
  - Botão "··· Mais ações" (Sheet/DropdownMenu com: Agendar visita, Repassar, Parceria, Descartar, Inativar)
  - `<DrawerEmpreendimento />`
  - Observações colapsável (Collapsible existente)

- **`DrawerTimeline.tsx`** (col direita 64%, bg white)
  - Tabs Histórico/Tarefas/Visitas (extrai do PipelineLeadDetail atual)
  - Reusa `TimelineSection` + `TimelineEventItem` do modo foco
  - Remove botão "+ Registrar Atividade" da Histórico

- **Refator `PipelineLeadDetail.tsx`** (942 → ~250)
  - Mantém: queries (`usePipelineLeadData`), mutations, handlers
  - Layout: `<Sheet><SheetContent class="flex"><DrawerLeadInfo .../><DrawerTimeline .../></SheetContent></Sheet>`
  - Passa tudo via props; sem duplicar lógica

## Fase 4 — Componentes internos

- **`DrawerActionGrid.tsx`**: grid 2x2 (Ligar / WhatsApp / Scripts / Anotar). Prop `nextAction` define qual vira primário (indigo p/ ligar, verde p/ whatsapp). Telemetria `drawer_action_clicked` já existe — só preservar.
- **`DrawerEmpreendimento.tsx`**: card com 3 métricas em linha, esconde coluna nula
- Caixa "Próxima Ação" integrada no DrawerLeadInfo

## Fase 5 — Anotar + cleanup

- **`DrawerAnotarDialog.tsx`**: Dialog simples (textarea + Salvar/Cancelar). Click no botão "Anotar" do grid abre. Chama `onAddAnotacao` existente. Dispara `drawer_anotar_saved`.
- Remove botão "+ Registrar Atividade" antigo de `LeadHistoricoTab.tsx` (toda observação livre vai pelo Anotar).
- Validação final: ESC fecha, telemetria viva, build limpo.

## Guardrails

NÃO tocar: Sprint 1, Dashboard v3, `useCorretorKpisCarteira`, `useTarefasHoje`, `usePipeline` core, DnD, virtualização, cache, webhooks Evolution, ConfiguracoesWhatsApp.

## Ordem de execução

Fases sequenciais com pausa pra validação visual após Fase 1, Fase 3 e Fase 4 conforme spec do usuário. Confirme aprovação para começar pela Fase 1.
