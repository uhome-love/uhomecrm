## Problema

Quando o corretor conclui uma ação na **Cadência Sem Contato**, o trigger `fn_cadencia_sc_avancar_acao` grava uma linha em `pipeline_historico` com `stage_anterior_id = stage_novo_id = Sem Contato` (não houve mudança de etapa) e a observação `Cadência Sem Contato — Tentativa N concluída: ...`.

O frontend (`LeadHistoricoTab.tsx`, linha 191-204) trata **qualquer** linha de `pipeline_historico` como mudança de etapa, exibindo "Movido para Sem Contato" — mesmo quando a etapa de origem e destino são iguais. Por isso aparece um "Movido para Sem Contato" indevido, quando deveria mostrar a progressão da tentativa.

## Correção (somente frontend)

Em `src/components/pipeline/LeadHistoricoTab.tsx`, no laço que monta os itens a partir de `historico`:

- **Detectar progressão de cadência**: quando `h.stage_anterior_id === h.stage_novo_id` (mesma etapa, sem movimentação real).
- Para esses casos, renderizar como evento de cadência:
  - **Título**: usar o texto da observação (ex.: "Cadência Sem Contato — Tentativa 1 concluída: Ligar agora") com um ícone de repetição (`RefreshCw`/`Repeat`, que já são usados no projeto) e cor neutra, em vez de `ArrowRight` "Movido para…".
  - **Sem o prefixo "De: …"** (não houve mudança de etapa).
- Manter o comportamento atual ("Movido para X" com "De: Y") apenas quando as etapas forem **diferentes** (movimentação real).

Nenhuma mudança no banco, trigger ou na geração do histórico — o registro continua sendo criado igual; apenas a forma de exibir muda. O texto "Tentativa N concluída" já vem da observação, atendendo ao pedido de mostrar a progressão da tentativa em vez de troca de etapa.
