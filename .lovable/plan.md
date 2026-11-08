# Eduardo Santos: credenciamento de domingo

## O que encontrei
- O Eduardo cumpre as regras: **2 visitas realizadas** em 07/11 (as duas de 05/11 foram No Show), Saúde do CRM aprovada e 8 presenças na semana.
- Ele **já conseguiu se credenciar hoje às 12h05** no turno de domingo (dia todo). O pedido está como **pendente, aguardando aprovação** do gestor. Ontem os pedidos dele foram aprovados por um gestor, mas o de hoje ainda não foi.
- **Ação imediata, sem mudar nada no sistema:** aprovar o pedido dele na tela de aprovação da Roleta.

## Correção que falta (mesma regra aprovada para o Roni)
A verificação feita no momento do credenciamento de domingo ainda conta visitas só de segunda a sábado. O aviso de elegibilidade já conta de segunda a domingo. O Eduardo passou porque as visitas dele são de sábado, mas um corretor com visita feita hoje seria barrado ao se credenciar.

1. Fazer a verificação de credenciamento de domingo contar de segunda até o próprio domingo, igual ao aviso.
2. Não mudar outros turnos, a regra noturna, a Saúde do CRM nem a distribuição.

## Detalhes técnicos
- Em `roleta_apto_janela`, no ramo de domingo, trocar `roleta_visitas_realizadas_periodo(p_auth_user_id, v_seg_atual, v_hoje - 1)` por `(..., v_seg_atual, v_hoje)`. É uma migration `CREATE OR REPLACE`, a 2ª do dia.
- Validar com o Roni (visitas 05 e 08/11, que deve ficar apto) e com o Eduardo (deve continuar apto).
