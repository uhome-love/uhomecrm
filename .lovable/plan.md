# Corrigir VGV de Vendas Assinadas por Equipe

## Princípio central (não pode ser violado)

**O corretor NUNCA perde VGV.** O VGV assinado consolidado do corretor (no ano, no período) continua exatamente o mesmo. O que muda é **só a equipe a que aquele VGV é creditado**, para não misturar resultados de equipe.

> Exemplo: Larissa fez R$ 1 milhão. Ela **continua com R$ 1 milhão** consolidado dela. Porém esse R$ 1 milhão foi feito **pela Equipe Gabrielle** e **não pode somar na Equipe Bruno**, mesmo a Larissa estando hoje no Bruno.

E a **Equipe Junior começa com 0** de VGV (o histórico do Junior-corretor e da Adri fica na Equipe Gabriel).

## Problema (diagnóstico confirmado no banco)

Hoje o VGV de equipe é calculado **sempre pela equipe atual** (`team_members` status `ativo`). Não existe histórico de equipe. Resultado:

- Larissa, Matheus Pasin, Luiza Clós, Halime, Thalia Pereira foram pro Bruno → **todo o VGV histórico delas migrou pro Bruno**.
- Thalia de Oliveira, Leo Dorneles, Jéssica França, Flávio foram pro Gabriel → **VGV histórico migrou pro Gabriel**.
- Adri foi pro Junior → VGV histórico dela migraria pro Junior.
- A **Equipe Gabrielle sumiu** dos cálculos (ela não é mais gerente ativa).

A coluna `negocios.gerente_id` existe mas está **inconfiável** (mistura id de perfil do gerente, id do próprio corretor e nulos), então não serve de "foto" sem ser refeita.

## Regra de negócio acordada

- **Corte: 17/06/2026.** Tudo assinado **até 17/06 (inclusive)** = equipe antiga. A partir de **18/06** = equipe nova.
- Ex-corretores da Gabrielle: vendas ≤ 17/06 → **Equipe Gabrielle**; ≥ 18/06 → equipe nova (Bruno ou Gabriel).
- Adri + Junior (como corretor): vendas ≤ 17/06 → **Equipe Gabriel**; Equipe Junior começa do zero a partir de 18/06.
- **VGV do corretor permanece intacto** (consolidado individual não muda nunca). Só muda o **agrupamento por equipe**.
- **Equipe Gabrielle = inativa porém visível** com o resultado histórico preservado.
- Nunca somar VGV da Gabrielle no Bruno/Gabriel.

## Solução

Criar uma **"foto" confiável da equipe dona da venda**, gravada em cada negócio, e passar os cálculos de VGV **assinado de equipe** a usar essa foto (em vez da equipe atual). O VGV **por corretor** continua somando pelo corretor (`auth_user_id`), sem alteração nenhuma. VGV de pipeline ativo (negócio em andamento) continua na equipe atual — o corretor trabalha hoje sob o novo gerente.

### Fase 1 — Banco: coluna snapshot + automação (migration)

- Adicionar coluna `negocios.equipe_gerente_auth_id` (uuid, referência lógica a auth.users) = gerente dono do VGV **de equipe** daquela venda.
- Criar trigger: quando um negócio vira `vendido` / ganha `data_assinatura`, grava automaticamente `equipe_gerente_auth_id` = gerente **atual** do corretor (via `team_members`), se ainda estiver vazio. Resolve todas as vendas futuras sem intervenção.

### Fase 2 — Backfill das vendas existentes (operação de dados)

Preencher `equipe_gerente_auth_id` em todas as vendas existentes (`vendido`/com `data_assinatura`) pela regra:

1. Corretor ex-Gabrielle **e** `data_assinatura ≤ 2026-06-17` → **Gabrielle**.
2. Adri ou Junior **e** `data_assinatura ≤ 2026-06-17` → **Gabriel**.
3. Caso contrário → gerente **atual** do corretor (cobre quem não mudou e vendas pós-corte).

> Importante: o backfill **só altera a etiqueta de equipe** do negócio. O `auth_user_id` (corretor) não é tocado — por isso o consolidado individual do corretor permanece idêntico.

### Fase 3 — Cálculos de VGV assinado por equipe

Ajustar as duas fontes que somam VGV por equipe para agruparem o **assinado** por `equipe_gerente_auth_id` (e não pela equipe atual). O VGV individual do corretor permanece como está.

- **RPC `get_pipeline_equipes_overview`** (tela Equipes do CEO): `vgv_assinado_mes` passa a vir do snapshot. Gerentes inativos com VGV no período (ex.: Gabrielle) aparecem como **equipe inativa** com o histórico preservado.
- **Hook `useCeoData.ts`** (rankings, dashboards, relatórios por período): o VGV assinado **por equipe** passa a agrupar pelo snapshot; inclui gerentes inativos (Gabrielle) quando há VGV no período. O **VGV por corretor permanece idêntico** (continua por `auth_user_id`).

### Fase 4 — Validação

- A soma do VGV assinado **da empresa não muda** (só a distribuição entre equipes).
- Cada corretor mantém **o mesmo VGV consolidado** de antes (ex.: Larissa continua com seu total).
- Equipe Gabrielle aparece com o histórico; Bruno/Gabriel **não** recebem o histórico dos ex-Gabrielle; **Equipe Junior = 0** e Junior mantém o VGV pessoal; Adri histórica fica no Gabriel.

## Detalhes técnicos (IDs canônicos)

Gerentes (auth.users.id):
- Gabrielle: `7882d73e-ff5c-4b23-9b08-2adeadcd1800`
- Bruno: `fb61ecda-5c4b-49d7-bda7-ccf9b589da07`
- Gabriel: `b3a1c3a4-f109-40ae-b5d4-15eff3a541ab`
- Junior: `7a270cc1-a457-4a02-8a62-462ba5a98937`

Ex-Gabrielle → Bruno: Larissa `6a4e1647`, Matheus Pasin `00a26f80`, Luiza Clós `aa95eb95`, Halime `9f3e6b46`, Thalia Pereira `4f29bb9d`.
Ex-Gabrielle → Gabriel: Thalia de Oliveira `c882b90d`, Leo Dorneles `c5eaf4f8`, Jéssica França `c988f004`, Flávio Dias `8981d8c6`.
Gabriel histórico: Adri `a5b6ca08`, Junior-corretor `7a270cc1`.

Corte: `data_assinatura <= '2026-06-17'`.

Observações:
- O snapshot é uma etiqueta **de equipe**; o vínculo corretor↔venda (`auth_user_id`) não muda → consolidado individual preservado.
- Não mexo na coluna antiga `gerente_id` (evito quebrar dependências); a foto fica numa coluna nova e limpa.
- `v_kpi_negocios` não expõe gerente; a atribuição de equipe é feita no consumidor (RPC/hook), então o split de parceria continua intacto.
- Migrations respeitam a janela (máx 2/dia, 08–19h BRT). Coluna+trigger = 1 migration; backfill = operação de dados (sem migration).

## Fora de escopo (alternativa futura)
Tabela de histórico de equipe (`team_members_history`) daria atribuição "as-of" genérica para qualquer métrica, mas é bem mais pesada. O snapshot por venda resolve exatamente o pedido (VGV assinado de equipe) com muito menos risco.
