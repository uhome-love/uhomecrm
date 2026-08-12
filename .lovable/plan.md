# Roleta: relatório de rotação (09–11/08) e correções propostas

## O que os dados mostram (últimos 2 dias)

Registros em `distribuicao_historico`: 156 distribuídos, 139 aceitos, 17 timeout, 136 foram para a Fila do CEO.

Distribuições por corretor (2 dias):

```text
Thalia de Oliveira   26      Luiza Clós        8      Paula Medeiros     3
Douglas Costa        24      Wendel Flores     8      Billy John         2
Rafaela Sandin       16      Cássio Ferreira   7      Eliézer Clós       2
Ebert Silva          14      Marcos Aurelio    6      Flávio Dias        2
Matheus Pasin        12      William Brizola   6      Gustavo Niz        1
Larissa Barbosa      10      Adriana Kaiser    5      William Ferreira   4
```

No mês, Douglas está com 77 leads e Thalia com 64 — o "84" da tela inclui também leads não vindos da roleta.

## A rotação não está quebrada — ela é justa dentro de um pote muito pequeno

O motor (`distribuir_lead_atomico`) escolhe sempre o corretor com **menos leads daquele produto naquele turno de hoje**, depois quem recebeu há mais tempo. Isso funciona. O desequilíbrio vem de três limites do desenho atual, todos confirmados nos dados:

1. **Produto identificado só vai para corretor ALOCADO ao produto.** 100% das distribuições dos 2 dias saíram do pote `alocado`; nenhuma caiu no rodízio geral por segmento.
2. **O pote é minúsculo em vários momentos.** Em 10/08, das 19h às 23h, o pote de "Casa Tua Porto Alegre" tinha **2 corretores** (Douglas e Thalia) — eles alternaram 1 a 1 e somaram ~20 leads em uma noite. Em "Connect JW" o pote foi de 2–4 (Rafaela e Matheus). Em "Flow" e "Lake Baikal" houve pote de tamanho 1.
3. **O contador zera a cada turno e é por produto.** Ninguém olha o total do dia/semana do corretor. Quem está alocado em 2 produtos e se credencia nos 3 turnos recebe em todos os potes ao mesmo tempo. Douglas e Thalia se credenciaram praticamente em todos os turnos; vários outros ficaram com 0–1 credenciamento em 2 dias.

Efeito colateral do mesmo desenho: **135 leads foram para a Fila do CEO por `sem_alocado_produto`** — nenhum corretor alocado àquele produto estava credenciado na hora. Ou seja, ao mesmo tempo em que 2 pessoas acumulam, 135 leads ficam parados.

Não encontrei sinal de bug: sem loop repetindo o mesmo corretor fora de ordem, sem lead distribuído duas vezes, sem ignorar o contador. É regra de negócio, não falha técnica.

## O que proponho corrigir (fases pequenas, uma por vez)

**Fase 1 — teto e visão do dia (sem mudar o pote).**
Trocar o critério de ordenação para considerar, além do produto/turno, o **total de leads do corretor no dia**. Assim, quem já pegou 12 hoje só volta a receber depois de quem pegou 3, mesmo em produto diferente. Opcional: teto diário configurável por corretor (ex.: 15/dia) — ao estourar, o próximo da fila leva.

**Fase 2 — pote mínimo com fallback.**
Quando o pote de alocados ativos for menor que N (ex.: 3), ampliar para corretores do mesmo segmento antes de mandar para a Fila do CEO. Isso ataca ao mesmo tempo a concentração e os 135 leads parados.

**Fase 3 — transparência.**
Painel na Roleta mostrando, por turno: tamanho do pote de cada produto, leads por corretor no dia e quantos foram para a Fila do CEO e por quê. Hoje esse dado só existe no banco.

## Detalhes técnicos

- Função central: `public.distribuir_lead_atomico` (ordenação em `ORDER BY recebidos_no_produto, ultima_distribuicao_at, leads_recebidos, fila_id`).
- Fase 1 = acrescentar um `recebidos_no_dia` (contagem em `roleta_distribuicoes` por corretor no dia BRT, sem filtro de produto/turno) como **primeiro** critério de ordenação; teto lido de `roleta_config`.
- Fase 2 = quando `count(elegiveis) < N`, seguir para o bloco de segmento em vez de gravar `fila_ceo/sem_alocado_produto`.
- Fase 3 = leitura de `distribuicao_historico` (já tem `pool`, `pool_size`, `recebidos_no_produto`).

Nada aqui muda credenciamento, elegibilidade (leads vermelhos) ou aceite/timeout.
