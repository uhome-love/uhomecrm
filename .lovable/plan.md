# Visitas da Larissa: deixar clara a conta da Roleta

## O que foi conferido
- A Roleta já conta certo: **3,5 visitas** para a Larissa nesta semana.
  - Jocarli (19/10 e 22/10, em parceria com Matheus): conta **1 vez**, metade para cada um = 0,5
  - Tayna Lohse = 1
  - Cesar Rideky = 1 (só dela)
  - Yalis = 1
- O "5" vem da **agenda de visitas**, que lista todas as visitas (inclusive a segunda do Jocarli). A agenda não é a conta da Roleta, mas confunde.

## O que vamos mudar (só visual, sem mexer na regra)
1. Na agenda, a segunda visita do mesmo cliente na semana ganha um selo discreto: **"Repetida — não conta para a Roleta"**.
2. Ao filtrar por um corretor, mostrar no topo: **"Para a Roleta: 3,5 visitas"**, com uma explicação curta ao passar o dedo/mouse (1 por cliente na semana; parceria vale 0,5).
3. Esse número vem da mesma conta da Roleta, para nunca divergir.

## Detalhes técnicos
- Selo calculado no front: agrupar visitas realizadas por corretor + cliente na semana (seg–dom BRT); a partir da 2a, marcar como repetida.
- Total do topo via RPC existente `roleta_visitas_realizadas_periodo` (sem migration).
- Teste unitário para a marcação de repetida em `src/lib/visitasRoleta.ts`.
