# Correções pendentes — Modal do lead + Board de Negócios (revisão 11/08)

Levantadas por revisão de código após o dia de refatoração (modal enxuto + História + card sóbrio de Negócios). **Nada publicado no Lovable ainda.** Atacar amanhã junto com o header.

## Verificação de saúde (feita 11/08)
- Board renderiza sem crash. Os erros `RegistrarSlot is not defined` no console eram **buffer velho do HMR** (código atual limpo, grep=0).
- Sem N+1 nas queries; typecheck limpo.
- "Pesado" = principalmente **Vite dev-mode** (centenas de módulos não-bundlados) + pane do Claude. Em produção (build Lovable) fica bem mais leve. Mas há peso real de re-render (abaixo).

## ALTO impacto / baixo risco
1. **`LeadHistoricoTab.tsx:~526` — `buildTimeline()` sem `useMemo`.** Roda a cada render e anula toda a memoização em cascata (`timeline`, `narrativaItems`, `sistemaItems`, `narrativaById`). Envolver em `useMemo(() => buildTimeline(...), [historico, atividades, tarefas, stages, lead.id, imovelEvents, anotacoes, nomesPorId])`. Provável MAIOR custo do modal.
2. **Bug introduzido hoje (Fase B) — key + `idDe` na Narrativa.** `DrawerTimelineGroup` no modo `renderItem` não aplica `key`; `idDe = sourceType-sourceId-date` colide p/ itens sem `sourceId` (eventos de imóvel / system) no mesmo `created_at` → `narrativaById.get()` pode retornar item errado/null e o marco **some**. Dar `key={ev.id}` no `renderItem` e tornar `idDe` único (incluir índice estável).
3. **`NegociosBoardInline.tsx:stripe()` — faixa verde no tone neutro.** Negócio saudável em andamento fica com a mesma faixa verde do Ganho. Só Ganho deve ser verde; neutro = cor discreta.
4. **`useNegociosBoard.ts:110-143` — 4 queries em série.** Paralelizar: `Promise.all([perfilMeu, negocios])` e depois `Promise.all([profiles, flags])`.
5. **`NegociosBoardInline.tsx:colInfo/itemsOf` — refiltra o array ~3×/coluna a cada render.** Um `useMemo` agrupando `negocios` em `Record<NegPasso, NegocioCard[]>` com VGV somado.

## MÉDIO (refactor maior)
6. **`PipelineLeadDetail.tsx` — re-render do drawer inteiro a cada tecla.** Estado de edição inline (`editName`, `editPhone`, `empreendimentoSearch`, `moveObs`…) no componente raiz de ~1150 linhas; `headerNode`/`bodyNode` reconstruídos todo render. Extrair formulários inline p/ subcomponentes com estado próprio (ou memoizar node trees).
7. **Código morto — diálogo "Inativar lead"** (`PipelineLeadDetail.tsx:273-354, 1003-1059`). `setInativarOpen(true)` nunca chamado. Decisão de produto: religar num botão ou remover (~80 linhas + 4 estados).
8. **`LeadHistoricoTab.tsx:586-590` — escrita duplicada de `ultima_acao_at`** (o hook `addAtividade` já grava). Remover o update redundante.
9. **`LeadHistoricoTab.tsx:479-498` — effect de `nomesPorId` depende do objeto `lead`** → re-dispara query. Depender de `lead.corretor_id`/`lead.corretor_anterior_id`.

## BAIXO
- `PipelineLeadDetail.tsx:210` — `lastActivity` atribuído e nunca usado; remover.
- `pendingTasks`/`overdueTasks` sem `useMemo` (arrays pequenos).
- `useNegociosBoard.ts:186` — `corretor: "—"` fixo em `prontos`; Pós-Visita não mostra corretor na lente Equipe (tem o mapa `nomeDe`, é só usar).
- `prontos.slice(0,15)` vs limit 12 na query — alinhar.

## Também amanhã
- **Header (Fase 3):** consolidar poluição de filtros. Componente sensível (797 linhas, 3 breakpoints) — passo isolado, testar nos 3 tamanhos.
- **Publicar no Lovable** (fetch+merge antes) depois de tudo validado.
