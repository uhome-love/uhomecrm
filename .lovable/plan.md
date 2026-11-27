# Contagem de descartes da Roleta: corrigir para todos os corretores

## O que encontrei
- A trava da Roleta bloqueia quem tem 100 descartes ou mais no mês.
- Hoje ela conta **todo cliente que está em Descarte no nome do corretor e cuja etapa mudou neste mês**, sem olhar quem descartou.
- Rafaela Campos: a trava conta **101**, mas ela mesma descartou **85** clientes em novembro. Os outros 19 entram por engano: descartes feitos por gestor ou por rotina automática (estagnados, cadência Sem Contato) e clientes descartados meses atrás cuja data foi mexida agora.
- O mesmo erro infla o número de todos: Douglas 91 (real 81), Ebert 86 (73), Thalia 74 (52), Luiza 67 (38), Gustavo 62 (35), entre outros. Rafaela é a única acima de 100 hoje.

## O que muda
1. **Liberar a Rafaela agora**: registrar o desbloqueio de novembro para ela (o recurso de desbloqueio manual já existe), para ela se credenciar ainda hoje.
2. **Nova régua, igual para todos**: descarte do mês = clientes diferentes que **o próprio corretor** moveu para Descarte neste mês (horário de Brasília), sem leads de teste. Não contam descartes feitos por gestor, CEO ou rotina automática, nem repetição do mesmo cliente.
3. O número mostrado ao corretor na tela de credenciamento e a trava usam a mesma conta.
4. Limite continua 100; nada mais na Roleta muda (CRM, visitas, vermelhos, Fila CEO).

## Conferência
- Comparar, corretor por corretor, número antigo × novo e mostrar a lista.
- Confirmar que a Rafaela consegue se credenciar no preview (sem mexer em leads reais).

## Técnico
- Função única `roleta_descartes_mes(p_corretor_id)` (contagem distinta em `pipeline_historico` → etapa tipo `descarte`, `movido_por` no escopo do corretor via `resolve_corretor_scope_ids`, `created_at` no mês BRT, `is_teste=false`).
- `corretor_pode_entrar_roleta` e `get_elegibilidade_roleta` passam a chamar essa função. 1 migration (fora do horário se já houver 2 hoje).
- Antes, conferir se algum caminho de descarte do corretor não grava `pipeline_historico` (achei descartes de hoje sem registro, ex.: Maicon Kerwald e Matheus Dall'Agnol às 09h53); se houver, corrigir esse caminho para gravar, senão o descarte não contaria.
- Desbloqueio: INSERT em `roleta_desbloqueios` (corretor da Rafaela, mes '2026-11').
