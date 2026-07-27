## Diagnóstico confirmado

- O placar mostrado em `/placar-do-dia` não usa o dashboard CEO nem `_kpi_team_window_core`; ele chama `rpc_placar_do_dia()` a cada 15 segundos (`src/pages/PlacarDoDia.tsx:180-311`).
- A RPC seleciona toda visita cujo registro foi **criado hoje** (`visitas.created_at`), sem excluir `origem='backfill_pos_visita'`. Por isso, alterar `data_visita` dos 22 registros para 26/07 não retirou nenhum deles do placar.
- Os 22 registros continuam sendo devolvidos pela RPC como `status='realizada'`, somados ao time Bruno e exibidos no feed “Últimas visitas”. Não é cache: a tela recarrega a resposta incorreta do banco a cada 15 segundos.
- A correção anterior de `data_visita` foi inválida: todos os 22 ficaram artificialmente em 26/07 às 10:00. Não há histórico individual confiável que prove essa data ou hora. `pipeline_historico` está vazio para os 22; `stage_changed_at` foi sobrescrito pela migração; as tarefas iguais de 20/07 foram geradas em lote e também não comprovam a realização da visita.
- O backfill ainda criou efeitos derivados: 22 eventos `visita_criada`, 22 eventos `data_alterada` e tarefas de feedback ligadas aos registros sintéticos.
- A origem estrutural foi movimentar/importar leads como “Visita Realizada” sem uma visita real registrada. O trigger novo `trg_pos_visita_garante_visita_fn` ainda tenta resolver isso criando uma visita automática com `CURRENT_DATE` e hora `10:00`, portanto pode repetir o problema.

## Plano de correção

### 1. Corrigir a fonte canônica do Placar do Dia

Atualizar `rpc_placar_do_dia()` para manter a regra comercial informada:

- **Visitas marcadas hoje:** registros reais criados hoje, excluindo qualquer origem técnica/sintética (`backfill_%` e `auto_stage_move`).
- Retornar separadamente as marcações reais e as realizações do dia, em vez de misturar todos os status em uma única lista.
- **Visitas realizadas hoje:** contar uma transição real de status para `realizada` registrada em `visita_eventos` no dia BRT; não usar criação de backfill nem `data_visita` inventada.
- Manter nome, empreendimento, corretor e timestamps necessários para ranking, feed e anúncios.
- Ajustar `PlacarDoDia.tsx` para consumir os conjuntos/campos explícitos da RPC, preservando a aparência atual e eliminando a ambiguidade entre “marcada” e “realizada”.

Resultado esperado para 27/07 com os dados atuais: o placar deixa de mostrar os 22 backfills imediatamente após o poll; as marcações reais vêm somente dos registros manuais do dia pertencentes aos times ativos.

### 2. Remover integralmente os 22 backfills artificiais

Como aprovado, executar uma limpeza cirúrgica restrita a `origem='backfill_pos_visita'` e ao lote criado em 27/07/2026:

1. Registrar antes da remoção uma evidência de auditoria agregada com IDs e motivo da reversão.
2. Remover tarefas automáticas cujo `origem_ref` aponta diretamente para os 22 IDs sintéticos.
3. Remover os respectivos registros de `visita_eventos`.
4. Remover os 22 registros de `visitas`.
5. Remover tarefas de feedback que foram criadas exclusivamente como efeito desse lote, identificadas por timestamp/origem e lead, sem tocar tarefas humanas ou anteriores.
6. Não alterar `pipeline_leads.stage_id`, `flag_status`, negócios ou visitas reais. Os leads permanecem em Pós-Visita para revisão operacional, mas não haverá uma visita falsa sustentando essa etapa.

A remoção de dados será feita pela operação de dados apropriada, não por migration DDL.

### 3. Eliminar a causa estrutural

Substituir o comportamento de `trg_pos_visita_garante_visita_fn`:

- Ao entrar em Pós-Visita sem visita real, **não criar** uma visita com data/hora inventadas.
- Bloquear a movimentação automática quando ela deveria vir de uma visita, ou sinalizar a inconsistência para correção, conforme o caminho da movimentação.
- Criar uma tarefa de pendência para o responsável registrar/agendar corretamente a visita, sem poluir `visitas`, agenda, PDN ou métricas.
- Garantir que o fluxo oficial continue sendo: visita existente → status `realizada` → trigger move para Pós-Visita.
- Manter idempotência para não duplicar tarefas/alertas.

### 4. Auditar todos os caminhos de movimentação

- Enumerar as RPCs, triggers e ações do frontend que movem lead para Pós-Visita.
- Garantir que nenhuma rota faça update direto e silencioso sem registrar `pipeline_historico`.
- Validar que importações legadas com texto “Etapa Jetimob: Visita Realizada” não sejam convertidas em visita real sem data comprovada.
- Levantar outros leads, inclusive arquivados, com Pós-Visita/flag realizada e sem visita real; apenas reportar os casos adicionais nesta fase, sem fabricar novos registros.

### 5. Validação ponta a ponta

Após as alterações:

- Banco: confirmar zero registros `backfill_pos_visita`, zero eventos/tarefas órfãos do lote e preservação das visitas manuais reais.
- Placar: abrir `/placar-do-dia`, aguardar dois ciclos de 15 segundos e confirmar que os 22 nomes desapareceram da contagem, ranking e feed.
- Agenda: validar 27/07 e 26/07 sem concentração artificial.
- CEO: confrontar cards de marcadas/realizadas com consultas BRT e eventos reais.
- PDN/Conferência de Visitas: confirmar que o total mensal cai em 22, pois esses registros não tinham evidência de visita real.
- Pós-Visita: abrir leads de teste sem alterar dados reais e confirmar que permanecem na etapa, mas sem visita falsa; validar a pendência operacional.
- Fluxo real com lead de teste: marcar visita, confirmar/realizar, verificar sincronização de flag, movimento para Pós-Visita, tarefas e atualização única do placar.
- Revisar o diff e registrar a regra permanente: backfill nunca cria visita sem data/hora comprovadas; origens técnicas nunca entram em placares operacionais.