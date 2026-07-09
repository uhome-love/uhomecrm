# Deixar o PDN 100% consistente com Pipeline e Vendas Realizadas

## Problema (confirmado no banco)

O PDN monta a coluna **Ganho** a partir da etapa do lead em `pipeline_leads`. Já **Vendas Realizadas** conta `negocios.fase = 'vendido'`. Quando um negócio é marcado como vendido mas o lead **não** é movido para a etapa "Ganho", ele conta na venda mas some do PDN.

Casos de dessincronia hoje (negócio vendido/ativo com lead fora da etapa Ganho):

```text
Cliente            Assinatura   Etapa do lead (errada)
Marcelo Dorneles   2026-07-04   Em Negociação      ← causa do "2 vendas, 1 no PDN" em julho
Edson Lopes        2026-05-31   Descarte
Joyce Silveira     2026-03-25   Em Negociação
```

Verifiquei o inverso também: **não há** lead em "Ganho" sem venda registrada. A única fonte de divergência é a dessincronia acima.

## Correções

### 1. Reconciliar os dados existentes (one-off)
Para os leads cujo negócio está `fase='vendido'` e `status='ativo'` mas a etapa do lead não é "Ganho":
- Mover o lead para a etapa **Ganho** (`pipeline_stages.tipo='venda'`).
- Definir `stage_changed_at` = data de assinatura do negócio (para o recorte mensal do PDN cair no mês certo).
- Registrar a mudança em `pipeline_historico` (rastreabilidade).
- Antes de aplicar, revalidar caso a caso — em especial **Edson Lopes**, cujo lead está em "Descarte": confirmar que a venda é real antes de promover a Ganho (se for engano de dado, tratamos como exceção e não movemos).

### 2. Sincronizar daqui pra frente (causa-raiz)
Fechar a lacuna que gerou a dessincronia, para nunca mais um negócio vendido ficar fora do Ganho:
- Ao marcar um negócio como **vendido** (fluxo `moveFase` em `useNegocios.ts` e demais pontos que setam `fase='vendido'`), mover automaticamente o `pipeline_lead` vinculado para a etapa "Ganho" e gravar `pipeline_historico`.
- Ao reverter de vendido, devolver o lead à etapa anterior coerente.
- Implementar de forma robusta via **trigger de banco** em `negocios` (cobre todos os pontos de entrada, inclusive edições diretas), mantendo o pipeline como fonte única.

### 3. Blindagem do PDN (defensivo)
No `usePdn.ts`, tratar como **Ganho** também os leads cujo negócio vinculado esteja `fase='vendido'` com `data_assinatura` no mês, mesmo que a etapa do pipeline esteja atrasada. Assim PDN e Vendas Realizadas nunca divergem, mesmo se algum dado escapar da sincronização.

### 4. Auditoria linha a linha (validação final)
Rodar e reportar um conjunto de checagens de consistência, corrigindo o que aparecer:
- Contagem/soma de **Ganho do PDN** = **Vendas Realizadas** do mesmo mês e escopo (por gestor/equipe).
- Cada linha Ganho com `data_assinatura`, `VGV`, `empreendimento` e `corretor` preenchidos (sinalizar faltantes).
- Sem duplicados (mesmo cliente/telefone) — reaproveitar o painel "Possíveis duplicados".
- Etapas Em Negociação/Contrato do PDN coerentes com a etapa real do lead.
- Mapeamento de escopo correto (auth id no pipeline × profiles.id em negócios) para o lead aparecer no PDN do gestor certo.

## Arquivos e mudanças
- **Migração de banco** — trigger em `negocios` para sincronizar etapa do lead quando `fase` muda para/di `vendido`.
- **Correção de dados (one-off)** — mover os 3 leads dessincronizados para Ganho com `stage_changed_at` = assinatura + histórico (após revalidar Edson Lopes).
- `src/hooks/usePdn.ts` — fallback: negócio vendido no mês entra como Ganho mesmo com etapa atrasada.
- Relatório de auditoria com o resultado das checagens do item 4.

## Resultado esperado
- Julho passa a mostrar **2 em Ganho** no PDN, batendo com Vendas Realizadas.
- Dessincronias futuras eliminadas na origem.
