# Lead que volta ao pipeline entra sem parceria

## O que encontrei (consulta só de leitura)
- **Taila Tejada Open** voltou hoje (04/11, 23h32 de 03/11 BRT) para distribuição, ainda **sem corretor** (aguardando aceite).
- Ela tem uma parceria **ativa desde 29/07/2026** com **Jéssica França**, de um atendimento antigo. Por isso o selo "c/ Jéssica" aparece no cartão.
- A regra que criamos só encerra a parceria quando o cliente **ganha um corretor novo**. Ela não cobre o momento em que o cliente **volta ao pipeline** (reativado, reaproveitado, saiu do arquivo ou foi para a Fila CEO sem corretor). E também não encerra se o novo corretor for um dos parceiros antigos.
- Hoje há **4 clientes** nessa situação: parceria ativa criada antes da última entrada no pipeline.

## O que vou fazer
1. **Regra no momento em que o cliente volta:** na mesma regra que já zera os relógios e as tarefas antigas ao voltar, encerrar **todas** as parcerias ativas desse cliente, com o motivo "Encerrada automaticamente: lead reentrou no pipeline" e um registro no histórico. Vale para todos os caminhos de volta.
2. **Regra na troca de corretor:** passa a encerrar a parceria em qualquer troca, inclusive quando o corretor sai (cliente vai para a Fila CEO).
3. **Limpar os 4 casos de hoje**, incluindo a Taila. Antes eu mostro a lista de nomes e você aprova.
4. **Roleta e histórico:** visitas já feitas durante a parceria continuam contando 0,5 para cada corretor, como já é hoje. Nada some do histórico.
5. **Parceria nova** continua possível: o corretor que receber o cliente pode registrar uma parceria do zero.

## Como vou testar
- Teste automático com um cliente de teste: cliente com parceria ativa é reativado → a parceria fica encerrada; troca de corretor → encerrada; parceria criada depois da volta → continua ativa.
- Conferir ao vivo que o selo "c/ Jéssica" sumiu do cartão da Taila.

## Detalhes técnicos
- Migration (fora do expediente, conforme regra de no máximo 2 por dia) alterando `reset_ciclo_reentrada` para incluir `UPDATE pipeline_parcerias SET status='encerrada'...` e ajustando `encerrar_parcerias_troca_corretor` (remover `NEW.corretor_id IS NOT NULL` e as exclusões de principal/parceiro). Manter `EXCEPTION WHEN OTHERS` para nunca travar a entrada do lead.
- Limpeza dos 4 casos via SQL de dados, após aprovação da lista.
- Atualizar a regra em `AGENTS.md`.
