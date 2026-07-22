# Plano: Unificar ações da planilha e do drawer do PDN

## Diagnóstico atual (confirmado por leitura do código)

Hoje o gestor faz a mesma coisa em dois lugares, com dois cliques diferentes:

| Campo | Planilha | Drawer | Problema |
|---|---|---|---|
| **Observação** | Popover com botão "Salvar" (só no PDN) + ícone separado "Publicar" no histórico | Campo de texto + botão "Publicar no lead" separado | Para publicar, o gestor escreve na planilha, salva, depois abre o drawer e escreve/publica de novo. |
| **Status** | `StatusSelector` inline na planilha | `Select` idêntico na aba Ação | Duplicado. A edição em qualquer lugar faz a mesma coisa. |
| **Empreendimento / VGV** | Células editáveis na planilha | Campos idênticos na aba Ação | Duplicado. |
| **Próxima ação + data** | Aparece no drawer e no Kanban como badge; não há edição direta na planilha | Campo editável na aba Ação | Fluxo fragmentado. |
| **Avisar corretor** | Ícone avião no card/linha + seção "Avisar corretor" no drawer | Seção "Avisar corretor" na aba Etapa | Ação duplicada; já decidimos torná-la automática. |
| **Marcar caiu** | Ícone seta para baixo na linha/card/drawer | Botão "Marcar como caiu" na aba Etapa | Duplicado; pode ser simplificado. |

## Decisões assumidas (pode reverter)

1. **A publicação no lead deve ser uma opção dentro do próprio campo de observação da planilha**, não uma ação separada.
2. **O drawer passa a ser principalmente de contexto + ações pesadas**, deixando a edição de rotina na planilha/kanban.
3. **Notificação interna ao corretor será automática** ao publicar uma observação (conforme decidido anteriormente).
4. **Botão "Avisar corretor" é removido**; em seu lugar, o sistema avisa automaticamente quando o gestor publica ou move etapa.

## Fases de implementação

### Fase 1 — Observação unificada na planilha (1 ação só)

Substituir o `ObsSelector` da planilha (`PdnGestor.tsx`) por um popover com duas opções explícitas:

- **"Salvar"** → grava apenas no overlay do PDN (`pdn_entries.observacoes`), sem tocar no pipeline.
- **"Salvar e publicar no lead"** → grava no PDN E publica no histórico do lead (`pipeline_anotacoes`) via `publicarNoLead()`.
- Ao publicar, dispara automaticamente `notifyBrokerOfPdnPublish()` (notificação interna) — sem botão de aviso separado.
- Remover o ícone de megafone "Publicar" da linha (`RowPublishButton`) e do card do Kanban (`PdnCard`), pois a publicação agora acontece dentro do campo de observação.
- Ajustar o `BulkActionBar`: trocar o botão "Publicar obs." para "Publicar e avisar corretor", já que a notificação é automática. Remover o botão "Avisar corretor" separado.

### Fase 2 — Drawer simplificado: menos campos, mais contexto

Na aba **Ação** do `PdnLeadDrawer`:

- Remover os botões "Publicar no lead" individuais ao lado de cada campo.
- Remover o campo **Status** (já editável inline na planilha/kanban).
- Remover o campo **Empreendimento / VGV** para negócios do pipeline (já editável na planilha; mantém apenas para negócios manuais).
- Manter campos que não existem na planilha: **Próxima ação + data**, **Prioridade** e **Risco/Motivo**.
- O botão "Salvar" do drawer passa a ser **"Salvar"** (local) e **"Salvar e publicar observação"** (quando houver texto e `pipelineLeadId`).

Na aba **Etapa**:

- Remover a seção "Avisar corretor" (torna-se automática).
- Manter: mudar etapa, limpar ajuste, marcar risco, marcar como caiu, remover da planilha.
- Adicionar o botão de **regredir etapa** (substituindo a lixa no futuro, mas neste plano mantemos só a remoção do avisar).

### Fase 3 — Kanban: mesmo padrão da planilha

No `PdnCard`:

- Remover o ícone de megafone "Publicar obs.".
- Ao clicar na observação, abrir o mesmo popover unificado da planilha (Salvar / Salvar e publicar).
- Remover o ícone de avião "Avisar corretor".
- Manter o ícone de "Marcar caiu".

### Fase 4 — Ações de lote ajustadas

No `BulkActionBar`:

- Remover botão "Avisar corretor".
- Manter "Publicar obs." (renomeado para "Publicar e avisar corretor"), já que a notificação é automática.
- Manter "Marcar caídos".
- Ajustar o `PdnKanban` para refletir a nova barra de ações.

### Fase 5 — Validação ponta a ponta

- Testar na visão CEO/gerente: editar observação na planilha, salvar e publicar, verificar se a nota aparece no histórico do lead e se o corretor recebe notificação interna.
- Testar no drawer: garantir que ainda é possível publicar observação sem duplicar texto.
- Testar no Kanban: garantir que o card abre o popover de observação e publica corretamente.
- Verificar que não há botões de "Avisar corretor" órfãos.

## O que NÃO muda

- A idempotência por SHA-1 continua: republicar o mesmo texto não duplica a nota no histórico.
- Overlay do PDN (`pdn_entries`) continua sendo a camada de gestão; a planilha é a interface principal.
- A aba "Contexto" do drawer continua mostrando a timeline do lead.
- Movimentação de etapa no PDN continua sincronizada com o pipeline (conforme já implementado).

## Arquivos envolvidos

- `src/pages/PdnGestor.tsx` — `ObsSelector`, `RowPublishButton`, `GrupoBloco`, `MobileCard`.
- `src/components/pdn/kanban/PdnCard.tsx` — ícones de publicar/aviso.
- `src/components/pdn/BulkActionBar.tsx` — ações em lote.
- `src/components/pdn/drawer/PdnLeadDrawer.tsx` — botões de salvar/publicar.
- `src/components/pdn/drawer/PdnTabAcao.tsx` — remoção de campos duplicados.
- `src/components/pdn/drawer/PdnTabEtapa.tsx` — remoção do "Avisar corretor".
- `src/components/pdn/drawer/publish.ts` — já existente; reutilizado.
- `src/lib/pdnSyncEngine.ts` — já existente; reutilizado para notificação automática.

## Mockup esperado

Antes de build, apresentar 2 mockups simples em HTML estático:
1. **Popover de observação na planilha**: textarea com botões "Salvar" e "Salvar e publicar no lead".
2. **Drawer simplificado**: aba Ação com apenas Próxima ação, Prioridade e Risco; botão "Salvar e publicar observação" no rodapé.