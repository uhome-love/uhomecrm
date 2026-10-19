# Auditoria completa das vendas (Jéssica França e demais corretores)

## Resultado da auditoria

Conferi todas as 111 vendas ativas e as que foram desfeitas.

**Está tudo certo em:**
- Nenhuma venda sem data de assinatura ou sem valor.
- Nenhuma venda duplicada no mesmo cliente.
- Nenhum lead em "Ganho" sem venda registrada.

**Problemas encontrados:**

### A. Vendas que sumiram porque o cliente voltou a negociar (2 casos)
Quando o corretor registra resultado de visita num cliente que já comprou, o sistema tira o lead de Ganho **e arquiva a venda**. A venda some de Vendas Realizadas, Ranking e VGV.
- **Rodrigo Generoso** — Jéssica França — Boa Vista Country Club — **R$ 770.000** (assinada 24/07; sumiu em 17/10)
- **Marco Aureli** — Billy John — Skyline Menino Deus — **R$ 327.077** (assinada 26/06; sumiu em 20/08)

### B. Parcerias que não aparecem para o parceiro em Vendas Realizadas (6 casos)
O VGV oficial (painéis e relatórios) já divide 50/50 corretamente. Só a tela Vendas Realizadas não mostra a venda para o segundo corretor:
- **Melissa Moreira** — Leo Dorneles + **Jéssica França** — Casa Tua — R$ 658.200 (14/04)
- **José Lauro da Rosa** — **Jéssica França** + Gustavo Niz — R$ 403.425 (03/03)
- Dieison Belmonte — Flávio Dias + Leo Dorneles — R$ 670.000 (21/08)
- Claudir Luis da Silva — Junior Padilha + Adriana Kaiser — R$ 508.721 (17/06)
- Edson Lopes — Rafaela Campos + Gustavo Niz — R$ 448.920 (31/05)
- Lucas — Larissa Barbosa + Matheus Pasin — R$ 308.000 (05/02)

### C. Pontos de atenção (não somem, mas vale conferir)
- **16 vendas só com valor estimado** (sem valor final preenchido), de 06/08 a 19/10 — ex.: Gisele Händel (William Ferreira) R$ 879.200, Ju Espaço da Beleza (Thalia) R$ 627.600. Elas contam no VGV pelo estimado; o corretor deve confirmar o valor final.
- **Matheus Saramento** (Adriana Kaiser, Mood, R$ 380.000): a venda conta, mas o lead saiu de Ganho em 08/09 — mesmo padrão do item A, sem perda de venda.

## O que será feito

### Fase 1 — Devolver as 2 vendas
- Rodrigo Generoso e Marco Aureli voltam a contar como vendidos, com a data e o valor originais.
- **O lead continua onde o corretor colocou** (Pós-Visita): o novo interesse do Rodrigo segue como uma segunda negociação, e se fechar vira uma segunda venda, sem apagar a primeira.

### Fase 2 — Impedir que se repita
- Mudar a etapa de um cliente que já comprou (por visita, PDN ou manualmente) **nunca mais arquiva a venda**. Venda só sai pelo botão de distrato/desistência.

### Fase 3 — Parcerias em Vendas Realizadas
- A tela passa a mostrar a venda para os dois parceiros com 50/50, usando a mesma régua do VGV oficial, sem dobrar o total da empresa.

### Fase 4 — Conferência final
- Comparar Vendas Realizadas com o VGV oficial mês a mês (janeiro a outubro) e mandar a lista das 16 vendas só com estimado, por corretor.

## Detalhes técnicos
- Fase 1: UPDATE `negocios.status='ativo'` nos ids `71e9e42e-3c5c-48dc-91d2-11363be30fbe` e `78652275-08a5-4077-9885-29cde879bc94`, com anotação no histórico do lead. Etapa do lead inalterada. Sem migration.
- Fase 2: localizar o caminho que grava `status='arquivado'` em negócio ganho ao sair de Ganho (gatilho no `pipeline_leads` e/ou `routeLeadAfterVisita` em `src/lib/visitaResultadoRouting.ts`) e excluir negócios `fase='ganho'` dessa regra. Se for gatilho, uma migration (DROP/recriar, sem overload), fora do pico.
- Fase 3: `src/pages/VendasRealizadas.tsx` — montar `parceriaPartners` também de `pipeline_parcerias` (status ativa), ou ler direto de `v_fato_venda`.
- Validação: Vendas Realizadas em julho (Jéssica, +R$ 770 mil), junho (Billy), abril/março (Jéssica parceira); simular resultado de visita em lead de teste em Ganho e apagar depois.
