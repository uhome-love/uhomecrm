# Ao vivo do Reengajamento — números 100% confiáveis

Os três blocos (Resumo de hoje, Disparos recentes, Envios sendo processados) continuam onde estão: só na aba **Ao vivo**. O trabalho é corrigir e alinhar os dados, que hoje se contradizem.

## O que está errado hoje (verificado no banco)

Hoje (05/08, BRT) existem **479** linhas de disparo: 185 entregues, 121 lidas, 12 respondidas, 48 só enviadas, 113 falhas.

1. **"Envios sendo processados" mostra números de amostra, não reais.** O card busca no máximo **400 linhas** dos 3 disparos mais recentes e conta em cima dessa amostra. Por isso ele mostra "296 enviados / 104 falhas" enquanto o Resumo de hoje mostra 475 / 112 — não é divergência de regra, é corte de página.
2. **Definições diferentes de "enviado" nos dois blocos.** O Resumo (função do banco) conta *enviado* como quem tem carimbo de envio (inclui quem já foi entregue/lido/respondido). O card conta *enviado* como "status diferente de falha". Dois números para a mesma palavra.
3. **Coluna LEAD vazia (—).** O disparo veio da Base Única, então o identificador guardado não é de lead do pipeline; a busca de nome só olha o pipeline e volta vazia.
4. **"Disparos recentes" não filtra por período.** Enquanto os outros dois blocos respeitam o filtro de período/dia, esse traz sempre os últimos 10, o que reforça a sensação de números que não batem.
5. **Rótulos ambíguos.** "Enviados/Entregues/Lidos" são acumulados de funil (quem foi lido também foi entregue e enviado), mas isso não está dito em lugar nenhum, o que faz o usuário somar as colunas e achar erro.

## O que vou fazer

1. **Contagens reais no "Envios sendo processados"**: trocar a contagem em memória por contagens agregadas no servidor, restritas aos mesmos disparos exibidos, usando exatamente as mesmas regras do Resumo de hoje. A tabela continua mostrando os últimos registros (com o rótulo "últimos 400 registros"), mas os contadores passam a refletir o total do disparo.
2. **Uma única definição de cada métrica**, aplicada nos dois blocos:
   - Enviados = tem carimbo de envio
   - Entregues = tem carimbo de entrega
   - Lidos = tem carimbo de leitura
   - Responderam = tem carimbo de resposta
   - Falhas = status de falha
3. **Nome do lead preenchido**: quando a origem for Base Única (ou o id não existir no pipeline), buscar o nome na Base Única; se ainda assim não houver, mostrar o telefone formatado em vez de "—".
4. **"Disparos recentes" respeita o período selecionado** no topo da aba, com um aviso quando houver disparo em andamento fora da janela.
5. **Legenda de leitura** curta no Resumo ("números acumulados do funil — quem leu também foi entregue") e tooltip em cada indicador com a regra exata.
6. **Validação ponta a ponta ao vivo** no preview: conferir, com o disparo do `casatua_novidadeterraco`, que Resumo, Disparos recentes e Envios sendo processados fecham entre si e contra as contagens diretas do banco.

## Detalhes técnicos

- Arquivo único: `src/components/central-nutricao/AuditoriaWebhookTab.tsx`. Sem migration, sem mudança em edge function.
- Contadores do card: substituir `queueStats` (derivado de `queueActivity`) por uma query com 5 `select(..., { count: "exact", head: true })` filtrados por `run_id in (queueRunIds)` e pelos mesmos predicados da RPC `reengajamento_resumo_hoje` (`sent_at not is null`, `delivered_at not is null`, `read_at not is null`, `responded_at not is null`, `status = failed`).
- Filtros de pill (`queueFilter`) passam a aplicar os mesmos predicados na query da lista (server-side), não em memória, para o filtro não brigar com o contador.
- Nomes: além de `pipeline_leads`, consultar `base_leads` (`id in (...)` → `nome`) para os ids não resolvidos; montar um mapa único.
- `recentRuns`: aplicar `gte/lte` em `started_at` com `from`/`to` já recebidos por prop, mais o disparo `running` sempre incluído.
- Semântica de `isSent` corrigida para `!!sent_at` (hoje é `status !== 'failed'`).
