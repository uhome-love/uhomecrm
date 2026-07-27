## Objetivo

No botão "Regredir" do PDN, além das etapas atuais (Visita Realizada / Em Negociação / Contrato), permitir regredir também para **Qualificação** e **Aquecimento** — etapas do pipeline que hoje ficam fora do PDN mas são destinos válidos quando o lead esfria.

## Diagnóstico

Hoje `PdnRegredirDialog` só oferece opções dentro do enum `PdnGrupo` (`visita_realizada`, `em_negociacao`, `contrato`, `ganho`), porque `syncPipelineStageFromPdn` mapeia grupo→`pipeline_stages.tipo` via `GRUPO_TO_STAGE_TIPO`. Qualificação e Aquecimento são stages reais (`tipo` = `qualificacao` e `aquecimento`) mas não existem como grupo PDN.

Regra do pipeline: ao regredir para uma etapa anterior a Visita, o `trg_clear_negocio_on_stage_regress` já limpa `negocio_id` e arquiva `negocios` — mesmo caminho já validado para regressão a Visita Realizada. Basta escolher o `stage_id` correto.

## Plano

### 1. `src/lib/pdnSyncEngine.ts` — aceitar destinos "pré-visita"
- Criar novo tipo interno `PdnDestino = PdnGrupo | "qualificacao" | "aquecimento"`.
- Estender `GRUPO_TO_STAGE_TIPO` com `qualificacao: "qualificacao"` e `aquecimento: "aquecimento"`.
- Estender `GRUPO_LABEL` com `Qualificação` e `Aquecimento`.
- Alterar assinatura: `syncPipelineStageFromPdn(row, destino: Exclude<PdnDestino, "caidos">, userId, opts?)`.
- Ajustar detecção de regressão: `isRegressao = destino === "visita_realizada" || destino === "qualificacao" || destino === "aquecimento"` (ou baseado em `ordem < 5`, que já cobre esses casos automaticamente).
- Para esses dois destinos: **não** criar/atualizar `negocios` (bloco `needsNegocio` já é falso porque não é em_negociacao/contrato/ganho). O trigger existente arquiva o negócio atual e limpa `negocio_id`.
- Persistência do `motivo_queda` em `negocios` antes do UPDATE do lead continua igual (usa `row.negocioId` atual, que é o que será arquivado).
- Título/mensagem da notificação continua funcionando via `GRUPO_LABEL[destino]`.

### 2. `src/hooks/usePdn.ts` — repassar destino ampliado
- `mudarEtapa` passa a aceitar o mesmo `PdnDestino` estendido em `grupoDestino` e apenas repassa para o engine.

### 3. `src/components/pdn/PdnRegredirDialog.tsx` — mostrar Qualificação e Aquecimento
- Estender `ORDER` para: `["qualificacao", "aquecimento", "visita_realizada", "em_negociacao", "contrato", "ganho"]`.
- Estender `GRUPO_LABEL` com `Qualificação` e `Aquecimento`.
- Trocar tipo de `destino` para o `PdnDestino` estendido.
- Lógica de "opções = etapas anteriores à atual" continua igual — agora automaticamente inclui os dois novos destinos para linhas em Visita Realizada, Em Negociação, Contrato e Ganho.
- Ordem de exibição: etapa imediatamente anterior primeiro (já é o comportamento atual com `.reverse()`).

### 4. `src/pages/PdnGestor.tsx` — sem mudança de estrutura
- Já usa `PdnRegredirDialog` + `mudarEtapa(row, destino, { motivo })`. Só precisa que o tipo do `destino` acompanhe o novo union — puramente tipagem, sem mudança de UX.

### 5. Validação (obrigatória antes de fechar)
Em lead de teste:
- Regredir de **Contrato → Qualificação** com motivo "teste qualificação":
  - `pipeline_leads.stage_id` = stage `tipo='qualificacao'`; `negocio_id` = NULL.
  - `negocios.status='arquivado'` e `motivo_queda='teste qualificação'`.
  - `pdn_entries` deixa de listar (não é mais grupo PDN ativo).
  - Notificação criada para o corretor com título "PDN: etapa regredida para Qualificação".
- Regredir de **Ganho → Aquecimento**: mesmo comportamento, stage `tipo='aquecimento'`.
- Regredir de **Contrato → Em Negociação** (fluxo já existente): continua funcionando, negócio permanece ativo mudando de fase.
- Cancelar diálogo → nada muda.
- Sem regressão do console e sem "piscar" no PDN.

## Fora de escopo
- Sem migration (as stages `qualificacao` e `aquecimento` já existem em `pipeline_stages`).
- Sem mudanças em RLS, triggers, ou fluxo de queda (`PdnQuedaDialog`).
- Sem mudanças no fluxo de avanço.
