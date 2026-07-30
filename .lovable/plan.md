# PDN 100% espelho do Pipeline — overlay só para observações internas

## Regra final
O PDN deixa de ter "verdade própria". Tudo que é dado de negócio (etapa, VGV, empreendimento, corretor, caiu, existência da linha) vem **exclusivamente do pipeline**. O gestor só escreve **anotações internas**.

Overlay que **permanece** em `pdn_entries` (gestor edita, não afeta pipeline):
- observações
- próxima ação + data
- prioridade
- risco manual + motivo
- marca de "corretor avisado"

Overlay que **sai** (hoje causa divergência):
- `oculto` (20 linhas) — esconde negócio ativo da planilha
- `caiu` (33 linhas) — deriva "caiu" só no PDN
- `grupo_override` (4 linhas) — muda a etapa só no PDN
- `empreendimento` / `vgv` editados na linha de pipeline
- linhas manuais avulsas (25) — negócio que só existe no PDN

## O que muda na prática para o gestor
1. **Nada some da planilha.** O botão "Remover da planilha" e o painel "Removidos" deixam de existir; toda linha do pipeline aparece sempre.
2. **"Marcar como caiu" passa a agir no pipeline**: abre o diálogo atual (motivo) e executa a perda/descarte real do lead/negócio. O lead sai do PDN porque saiu do pipeline — não por marcação paralela.
3. **Mover card entre colunas do Kanban do PDN** passa a mover a etapa real do lead no pipeline (mesma RPC usada hoje pelo Pipeline), com registro no histórico do lead. Sem `grupo_override`.
4. **Empreendimento e VGV viram somente-leitura** no PDN; editar é no lead/negócio (link "Abrir lead" na linha).
5. **Linha manual**: botão "Adicionar linha" é removido; para entrar no PDN o negócio precisa existir no pipeline. O card "Divergências" já criado cobre os casos de negócio sem lead / lead sem negócio.
6. **Observações, próxima ação, prioridade e risco continuam iguais** — é o espaço do gestor.

## Migração dos dados existentes (executada item a item, com sua aprovação)
- 20 `oculto`: apenas ignorados (o negócio volta a aparecer). Nenhuma escrita destrutiva.
- 33 `caiu`: listados num relatório antes de qualquer ação — para cada um, ou o lead já está perdido/arquivado no pipeline (nada a fazer) ou o gestor decide se derruba de verdade.
- 4 `grupo_override`: relatório com etapa PDN x etapa pipeline, gestor confirma qual vale.
- 25 linhas manuais: relatório com nome/VGV; as que forem negócios reais viram negócio no pipeline; as demais são arquivadas.

Enquanto a migração não roda, as colunas continuam no banco (nada é dropado); o PDN simplesmente para de lê-las como verdade.

## Fases
- **Fase A (frontend)** — PDN passa a ler só o pipeline + notas: remove leitura de `oculto`/`caiu`/`grupo_override`/`vgv`/`empreendimento` do overlay, remove painel de removidos e o botão de linha manual, e religa "caiu" e "mover etapa" nas ações reais do pipeline.
- **Fase B (relatórios de migração)** — telas/exports com as 33 quedas, 4 overrides e 25 manuais para você decidir caso a caso.
- **Fase C (limpeza de dados)** — aplicar as decisões da Fase B; só depois, se quiser, uma migration marca as colunas como legadas.

## Detalhes técnicos
- `src/hooks/usePdn.ts`: `allRows` deixa de aplicar `caiu`/`oculto`/`grupo_override`/`vgv`/`empreendimento` do override; `rows` = todas as linhas do pipeline; `hiddenRows` some. `saveOverride` fica restrito a observações/próxima ação/prioridade/risco/avisado. `marcarQueda` passa a chamar a ação real de perda do negócio (`useNegocioActions` / descarte do lead), `mudarEtapa` passa a mover `pipeline_leads.stage_id` pela mesma rota do Pipeline, com log em `pipeline_atividades`.
- `src/pages/PdnGestor.tsx`: remove bloco "Removidos da planilha", badges de ocultos, `addManualRow`/`deleteRow`; células de empreendimento/VGV viram texto; mantém `PdnDivergencias`.
- `src/components/pdn/PdnToolbar.tsx`: remove toggle de ocultos e contador de removidos.
- Nenhuma migration nas Fases A e B; nada é escrito em `negocios`/`pipeline_leads` fora das ações explícitas do gestor.
