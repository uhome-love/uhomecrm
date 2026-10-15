# Roleta noturna — corrigir a checagem de "marcou visita hoje"

## O que encontrei
A regra combinada: entra na Roleta da noite quem **marcou** uma visita hoje (para qualquer dia) **ou realizou** uma visita hoje, com a saúde do CRM em 80% ou mais.

Hoje o sistema confere outra coisa: só aceita visita **com data para hoje**. Quem marcou hoje uma visita para sábado fica bloqueado com o aviso "falta marcar visita".

Isso pega hoje pelo menos: Adriana Kaiser (marcou 2, para 17 e 18/10), Rafaela Sandin (2, para 17/10), Matheus Pasin (2), Pedro Jorge (3), Wendel, William, Rafaela Campos, Flávio, Thalia, Lucas Johnson, Jéssica, Douglas e Billy John.

## Correção
Passa a valer, no dia de hoje (horário de Brasília):
- **Marcou hoje:** qualquer visita criada hoje, para qualquer data, que não esteja cancelada.
- **Realizou hoje:** visita com data de hoje e resultado "realizada".
- O que já valia continua valendo (visita com data de hoje marcada ou confirmada).

A regra dos 80% e as outras regras da noite não mudam. Só a parte da visita.

## Validação
Depois da correção, conferir com os dados de hoje (só leitura) que Adriana, Rafaela Sandin e os outros da lista passam na regra de visita. Mostrar quem continua bloqueado e por qual motivo (por exemplo, CRM abaixo de 80%).

## Detalhes técnicos
- Uma migração só: `CREATE OR REPLACE FUNCTION roleta_tem_visita_hoje(uuid)`, mesma assinatura. Nova condição em `visitas`: `(created_at AT TIME ZONE 'America/Sao_Paulo')::date = hoje AND status NOT IN ('cancelada','reagendada')` OR `data_visita = hoje AND status IN ('marcada','confirmada','realizada')`. Corretor por `corretor_id = auth id` ou pelo `profiles.id`, como hoje. Mantém o ramo de `pipeline_atividades`.
- Quem chama a função (`corretor_pode_entrar_roleta_noturna`, `roleta_motivo_bloqueio`, `roleta_apto_janela`) não muda.
