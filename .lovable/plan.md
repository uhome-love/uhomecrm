
# Fase 3 — Kanban nível SaaS (PDN Gestor)

Entendimento detalhado antes do build. Só sigo depois do seu OK.

## Estado atual
- Kanban funciona (drag-and-drop entre etapas, card com nome/empreendimento/VGV/status/próxima ação/risco).
- Card só abre drawer no clique. Sem seleção, sem ações rápidas, sem filtro dentro do Kanban.
- Colunas com altura fixa `calc(100vh - 320px)`, largura 290px, scroll horizontal.
- Colunas de "Caídos" some quando vazia. Demais sempre aparecem.

## O que muda nesta fase

### 1. Header da coluna com WIP e VGV ponderado
- Além do total bruto que já existe, mostrar **VGV ponderado** (VGV × probabilidade da fase: Visita 30% / Negociação 50% / Contrato 80% / Ganho 100%). Ajuda o gestor a ler forecast de olho.
- Contador "N novos" e "N em risco" já existem. Reforço visual: `N novos` vira badge azul discreto, `N em risco` vira badge âmbar.
- Título do grupo ganha ícone da fase (mesmo do sidebar).

### 2. Ações rápidas no card (hover no desktop, sempre visível no mobile)
- Botão pequeno no canto do card com 3 ações:
  - **📢 Publicar observação no lead** (mesmo idempotente da Fase 1/2). Só habilita se `r.observacoes` tem conteúdo.
  - **⚠️ Marcar como caiu** (abre `QuedaDialog`).
  - **📣 Avisar corretor** (mensagem padrão "Atualize o pipeline de {nome} para {etapa}").
- Sem sair do Kanban, sem abrir drawer. Zero mudança em `usePdn`.

### 3. Filtros dentro do Kanban (mini-toolbar no topo do Kanban)
- Hoje os filtros ficam no header da página (só afetam a planilha). No Kanban vou adicionar uma toolbar compacta acima das colunas:
  - Toggle **"Só em risco"** (filtra `r.emRisco === true`).
  - Toggle **"Só novos desde ontem"** (`r.novoDesdeOntem`).
  - Select **Corretor** (mesma lista já usada na planilha).
- Aplicam-se em cima das `rows` que o Kanban recebe. Sem tocar em `PdnGestor`.

### 4. Seleção múltipla no Kanban + barra de ação
- Checkbox pequeno no canto superior esquerdo do card (só aparece no hover ou quando há seleção ativa).
- Reaproveita **`BulkActionBar`** criado na Fase 2 (mesmas 3 ações: publicar / avisar / caiu).
- Seleção zerada ao trocar filtros do Kanban.

### 5. Drop nas mesmas regras + feedback
- Drop entre etapas → `onMudarEtapa` (já existe).
- Drop na coluna "Caídos" → abre `QuedaDialog` (já existe).
- Drop saindo de "Caídos" → `onReativar` (já existe).
- Adiciono **feedback visual mais forte** durante o drag: outline âmbar no card sendo arrastado, coluna alvo com sombra interna, e um pequeno toast neutro após o drop bem-sucedido ("Movido para {etapa}").

### 6. Empty state útil
- Coluna vazia hoje mostra só "Vazio". Vou trocar por CTA discreto: "Sem negócios nesta etapa" + botão "Adicionar manual" (só se não for "Caídos").

## O que NÃO muda
- Hook `usePdn.ts`, migrations, RPC. Zero mudança de banco.
- Regras de queda/reativação (Fase 4 é integração bidirecional).
- Drawer (Fase 1) e Planilha (Fase 2).
- RLS / permissões (Fase 7).

## Arquivos afetados
- `src/components/pdn/PdnKanban.tsx` — cresce, mas fica <300 linhas. Sem quebrar props (assinatura idêntica).
- `src/components/pdn/BulkActionBar.tsx` — reutilizado, sem mudança.
- `src/components/pdn/kanban/PdnCard.tsx` — **novo** (~120 linhas), extrai o `PdnCard` que hoje mora dentro de `PdnKanban.tsx` e ganha ações + checkbox.
- `src/components/pdn/kanban/KanbanToolbar.tsx` — **novo** (~70 linhas), mini-toolbar de filtros.
- Reutiliza `QuedaDialog` já existente do `PdnGestor.tsx` (via prop callback `onQueda`).

Nenhum arquivo passa de 800 linhas. `PdnGestor.tsx` já está em 1187 e continua assim — Fase 6 (Modularização) resolve isso separadamente.

## Riscos e mitigações
- **Drag conflitando com checkbox** → checkbox absorve `stopPropagation` + `draggable=false`.
- **Barra de lote sobrepondo colunas em telas pequenas** → mesma barra da Fase 2, já responsiva.
- **Filtro do Kanban confundindo com filtro global** → toolbar visualmente distinta (fundo `muted/40`, tag "Kanban" no início).

## Validação (ponta a ponta, no preview)
1. Card com observação → botão publicar aparece → clico → confere em `pipeline_anotacoes` que não duplica.
2. Card sem observação → botão publicar desabilitado.
3. Toggle "Só em risco" → só cards com âmbar ficam.
4. Filtro por corretor → só cards do corretor selecionado.
5. Selecionar 3 cards de colunas diferentes → barra de lote com 3 → publicar em massa funciona.
6. Arrastar card de "Visita" pra "Caídos" → abre QuedaDialog.
7. Arrastar de "Caídos" pra "Contrato" → reativa como Contrato.
8. Header mostra VGV bruto E ponderado.
9. Empty state com CTA "Adicionar manual" funciona.
10. Mobile: ações do card sempre visíveis, drag funciona (long-press nativo).

---

**Confirma que esse é o entendimento correto?** Se sim, sigo para o build. Se quiser tirar/mudar algo (ex: dispensar VGV ponderado, tirar checkbox do Kanban, deixar filtros só na página), me avisa antes.
