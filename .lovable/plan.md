# Conferência do mostrador de tentativas + limpeza do histórico inconsistente

## Resultado da conferência (concluída)

- **Mostrador "Tentativa N / 7": CORRETO em 209/209 leads.** O `tentativa_atual` bate 100% com as ações reais registradas após o início da cadência. Nenhum corretor está vendo contador errado.
- **Histórico: 19 leads** com linha inflada (ex.: "Tentativa 6 concluída") que contradiz o contador — resíduo de uma versão antiga do gatilho, já corrigido. Confunde o corretor.
- **`tentativas_log`: 81 leads** com entradas "fantasma" (campo interno, não exibido no card) — apenas higiene.
- O gatilho atual (`fn_cadencia_sc_avancar_acao`) já grava corretamente → **não há recorrência**; nenhuma mudança de código/trigger/UI necessária.

## Correção proposta (somente dados, sem schema, sem regra)

1. **Remover as 19 linhas de histórico falsas** — registros `pipeline_historico` cujo texto começa com `Cadência Sem Contato — Tentativa N…` em que **N > `tentativa_atual` real** do lead. Histórico legítimo (N == contador) é mantido. Eventos reais (WhatsApp, Follow-up, "Movido para Sem Contato") permanecem intactos.

2. **Sanear o `tentativas_log` dos 81 leads** — manter apenas os elementos com `(n)::int <= tentativa_atual`, descartando os inflados. Não altera o contador (já correto).

3. **Não tocar** em `tentativa_atual` nem no status da cadência (já validados como corretos).

## Validação após a correção

- Reexecutar a conferência: confirmar **0 leads** com histórico inflado e **0** com log inflado.
- Abrir Gabriela Rezende: card continua em "Tentativa 2/7"; o histórico deixa de mostrar "Tentativa 6"; os eventos reais permanecem.
- Conferir 2–3 leads da lista (Jhon Lima, Everson Oliveira) para garantir que só o lixo foi removido.

## Detalhes técnicos

- Operação via ferramenta de dados (DELETE/UPDATE) — é correção de dados existentes, sem migração de schema.
- Histórico: `observacao ILIKE 'Cadência Sem Contato — Tentativa%'` e número extraído `> tentativa_atual` do lead correspondente, restrito à etapa Sem Contato.
- Log: reconstruir `tentativas_log` filtrando `(elem->>'n')::int <= tentativa_atual`.
- Sem alteração em gatilhos, crons ou componentes de UI.

## Fora de escopo

- Nenhuma mudança nas regras da cadência (avanço só por ação/tarefa concluída; aviso 24h; estagnação 48h).
- Nenhuma mudança no `CadenciaSemContatoCard` — o mostrador já está correto.
