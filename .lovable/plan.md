# Auditoria das vendas da Jéssica França (e demais corretores)

## O que aconteceu

### 1. Rodrigo Generoso — Boa Vista Country Club (R$ 770.000, assinada 24/07)
- A venda existe, mas no sábado 17/10 às 12h01 ela foi **arquivada**.
- Causa: a Jéssica registrou o resultado de uma visita desse cliente ("gostou, vai pensar"). O fluxo de resultado de visita **tirou o lead de Ganho e jogou para Pós-Visita**, e com isso o negócio vendido foi arquivado e sumiu de Vendas Realizadas, Ranking e VGV.
- Ou seja: é um **defeito do sistema**, não erro da corretora. Registrar visita num cliente que já comprou não deveria desfazer a venda.

### 2. Melissa Moreira — Casa Tua (R$ 658.200, assinada 14/04)
- A venda está intacta e ativa. Foi uma **parceria 50/50 com o Leo Dorneles** (que era o dono do lead).
- No relatório oficial de VGV a metade da Jéssica (R$ 329.100) aparece certinha.
- Mas a tela **Vendas Realizadas** só reconhece parceria quando existem dois registros de negócio separados. Aqui a parceria foi registrada no lead (aba de parcerias), com um negócio só, no nome do Leo. Por isso, na visão da Jéssica, ela não aparece. Com o Leo inativo, a venda fica "escondida".

## Aconteceu com outros?

**Mesmo problema do Rodrigo (venda desfeita por resultado de visita):**
- **Billy John — Marco Aureli, Skyline Menino Deus (R$ 327.077, assinada 26/06)** — arquivada em 20/08 pelo mesmo motivo. Sumiu das vendas de junho.
- Nenhum outro caso desse tipo desde junho.

**Mesmo problema da Melissa (parceria que não aparece para o parceiro em Vendas Realizadas):**
- Dieison Belmonte (Terrace, 21/08) — Flávio Dias + Leo Dorneles (sem VGV preenchido)
- Claudir Luis da Silva (17/06) — Junior Padilha + Adriana Kaiser
- Edson Lopes (31/05) — Rafaela Campos + Gustavo Niz
- José Lauro da Rosa (03/03) — Jéssica França + Gustavo Niz
- Lucas (05/02) — Larissa Barbosa + Matheus Pasin

Nesses casos o VGV oficial (painéis, relatórios) já está certo; só a tela Vendas Realizadas não mostra para o parceiro.

## O que será feito (em fases)

### Fase 1 — Devolver as vendas desfeitas
- Rodrigo Generoso e Marco Aureli: negócio volta para vendido/ativo, com a mesma data de assinatura e VGV. O lead volta para Ganho, com anotação explicando a correção.

### Fase 2 — Impedir que se repita
- Resultado de visita **nunca tira um lead de Ganho** nem mexe em negócio vendido. A visita fica registrada no histórico normalmente, mas a etapa não muda.

### Fase 3 — Parcerias em Vendas Realizadas
- A tela passa a reconhecer também as parcerias registradas no lead, mostrando a venda para os dois corretores com 50/50 — mesma régua do VGV oficial, sem dobrar a venda.

## Detalhes técnicos
- Fase 1: UPDATE em `negocios` (ids `71e9e42e-…` e `78652275-…`) `status='ativo'`; `pipeline_leads.stage_id` → Ganho para `0697c272-…` e `61cdc8a4-…`, com anotação no histórico. Sem migration.
- Fase 2: em `src/lib/visitaResultadoRouting.ts` (`routeLeadAfterVisita`), sair cedo se o lead está na etapa Ganho; conferir também o gatilho que arquiva o negócio ao sair de Ganho.
- Fase 3: em `src/pages/VendasRealizadas.tsx`, montar `parceriaPartners` também a partir de `pipeline_parcerias` (status ativa), ou ler de `v_fato_venda` (fonte única já rateada).
- Validação: conferir na tela Vendas Realizadas (julho Jéssica, junho Billy, abril Jéssica) e simular resultado de visita em lead de teste em Ganho, apagando depois.
