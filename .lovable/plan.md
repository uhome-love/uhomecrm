# Roni: aviso "Não elegível · domingo" mesmo incluído na Roleta

## Situação atual
- Pela regra, o Roni **não cumpre** o requisito de domingo: precisa de 2 visitas realizadas de segunda a sábado da semana anterior (02 a 07/11) e teve 1 (05/11). A visita de 06/11 foi No Show, e a de hoje (08/11) conta para a semana seguinte.
- Ele está **ativo na Roleta** porque você o incluiu manualmente. A inclusão manual passa por cima da regra, mas o aviso continua mostrando o resultado da regra.
- O cartão "Visitas" confunde: mostra um sinal verde com "0 sem. passada / mín. 2" e "Esta semana 2/2". O "2/2" vale para o **próximo** domingo, não para hoje.

## Proposta (somente a tela, sem mudar distribuição nem regras)
1. Quando o corretor for incluído manualmente, trocar o aviso para "Incluído manualmente · domingo" (em azul). Assim fica claro que ele está na Roleta por decisão da gestão.
2. No cartão Visitas, mostrar o sinal verde só quando a meta da semana anterior foi cumprida. Trocar "Esta semana 2/2" por "Para o próximo domingo: 2/2".
3. Fazer o cartão usar a mesma contagem da regra de domingo. Hoje o cartão mostra 0 e a regra conta 1.

## Ordem
Mockup para aprovação → plano → construção → conferência ao vivo com o Roni.

## Detalhes técnicos
- `elegivel_roleta_domingo` conta direto em `visitas`; o cartão usa `roleta_visitas_realizadas_periodo`. Alinhar a tela à fonte canônica (`roleta_visitas_realizadas_periodo`) e verificar se o 0 vs 1 vem de parceria (0,5) ou do id do corretor.
- A inclusão manual é detectada pelo registro de credenciamento manual. Não alterar `distribuir_lead_atomico`.
