# PDN — correção de gravação, auditoria e repaginação

## Diagnóstico (confirmado no código e no banco)

**1. Empreendimento e VGV não salvam (causa raiz confirmada).**
Na refatoração "PDN espelho do pipeline", `saveOverride` (`src/hooks/usePdn.ts`) passou a aceitar apenas notas internas (observação, próxima ação, status, prioridade, risco, avisado). Mas a planilha e o kanban continuam chamando `onSave(r, { empreendimento })` e `onSave(r, { vgv })`. Como nenhuma dessas chaves entra no payload, a função cai no `if (Object.keys(payload).length === 0) return;` — **sai em silêncio, sem erro e sem toast**. Existe a função correta e não usada `syncNegocioVgvFromPdn` em `src/lib/pdnSyncEngine.ts`, que grava em `negocios.vgv_final` / `negocios.empreendimento`.

**2. Notas de outro gestor não salvam (silencioso).**
As policies de `pdn_entries` restringem SELECT/UPDATE a `gerente_id = auth.uid()` (ou admin/diretor). Quando a linha já tem overlay criado por outro gestor, o update afeta 0 linhas e o Supabase **não retorna erro** — o usuário vê "salvo" e nada muda. Também significa que dois gestores da mesma equipe não enxergam a mesma observação.

**3. Overlay sem recorte de mês.**
`overrideByNegocio` / `overrideByLead` indexam por negócio/lead ignorando `mes`, então uma anotação de julho aparece em agosto e a escrita vai para a linha do mês antigo.

**4. Código morto pós-refatoração.**
`hiddenRows` sempre vazio, `addManualRow` / `deleteRow` / `isManual` / `grupoOverride` / `etapaAjustada` / `oculto*` continuam no tipo, no hook e nos componentes, mas nada disso é mais exibido. `PdnGestor.tsx` tem 1247 linhas com tabela, card mobile, seletores e dialogs no mesmo arquivo.

## O que vai ser feito

### Fase 1 — Gravação correta (o bug)
- Empreendimento e VGV editados no PDN passam a gravar **no negócio real** (`negocios`), via `syncNegocioVgvFromPdn`, e o valor volta pelo refresh do pipeline. Sem negócio vinculado, o campo aparece bloqueado com dica "sem negócio vinculado — abrir o lead" em vez de aceitar digitação que se perde.
- `saveOverride` deixa de falhar em silêncio: retorna sucesso/erro, e toda gravação dá feedback (toast de erro real ou confirmação discreta).
- Correção do 0-rows silencioso: após update em `pdn_entries` usamos retorno de linhas; se vier vazio, criamos/atualizamos o overlay do gestor logado em vez de dar "salvo" falso.
- Recorte de mês no overlay: overlay só é lido/escrito para o mês selecionado.

### Fase 2 — Overlay compartilhado por equipe (migration)
Ajustar as policies de `pdn_entries` para que gestores da mesma equipe (e admin/diretor) vejam e editem o mesmo overlay, mantendo o registro de quem escreveu. Sem isso a Fase 1 resolve o silêncio, mas não a colaboração entre gestores.

### Fase 3 — Limpeza estrutural
- Remover do hook e dos componentes: `hiddenRows`, `addManualRow`, `deleteRow`, `isManual`, `grupoOverride`, `etapaAjustada`, `oculto`, `ocultoEm`, `ocultoPor` (colunas ficam no banco, só param de ser lidas).
- Quebrar `PdnGestor.tsx` (1247 linhas) em: `PdnPlanilha.tsx` (tabela desktop), `PdnMobileList.tsx`, `PdnCells.tsx` (célula editável / status / observação) e a página como orquestrador (<300 linhas).

### Fase 4 — Visual e usabilidade
- Cabeçalho único: mês, KPIs (VGV por etapa, forecast ponderado, nº em risco) e ações à direita, com a identidade Indigo/Deep Slate do CRM.
- Planilha: cabeçalho fixo (sticky), zebra sutil, coluna Nome fixa, subtotais por grupo alinhados, VGV monoespaçado e alinhado à direita, badges de status com tokens semânticos.
- Sinalização clara de campo somente-leitura vs editável (pipeline x nota do gestor), com link "Abrir lead" em cada linha.
- Estados vazios e de erro decentes por grupo; skeleton em vez de spinner de tela cheia.
- Kanban: cards com hierarquia (nome, VGV, corretor, próxima ação, risco), contagem/subtotal por coluna e mesmo drawer da planilha.

### Fase 5 — Validação ao vivo
Testar no preview, com lead de teste: editar empreendimento e VGV (confirmar no banco), editar observação/próxima ação como gestor e como admin, mover etapa no kanban, marcar queda (cancelando), exportar CSV, e conferir Ganho do PDN = Vendas Realizadas.

## Detalhes técnicos
- `src/hooks/usePdn.ts`: novo `saveNegocioCampos(row, { vgv, empreendimento })` chamando `syncNegocioVgvFromPdn` + `loadDeals()`; `saveOverride` com retorno booleano, filtro de `mes` no índice de overlay e `.select("id")` no update para detectar 0 linhas.
- `src/pages/PdnGestor.tsx` / `PdnKanban.tsx`: `PdnSavePatch` perde `empreendimento`/`vgv`; esses campos passam pelo novo handler.
- Migration (Fase 2) apenas nas policies de `pdn_entries` — nenhuma DDL de tabela, dentro do limite de migrations/dia.

## Ordem de aprovação
Fases 1 e 3 juntas (bug + limpeza), depois Fase 4 (visual), Fase 2 (migration) fora do horário de pico. Cada fase validada no preview antes da seguinte.
