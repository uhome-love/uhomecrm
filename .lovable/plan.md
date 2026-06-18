# Plano: reduzir o custo diário do Cloud (sem quebrar nada)

O custo alto não vem de mais uso e sim de **3 consultas que rodam milhões de vezes fazendo varredura completa de tabela** (full scan). A correção é adicionar **índices** no banco — uma mudança aditiva e segura: não altera dados, não altera regras de acesso (RLS), não muda nenhuma tela nem comportamento. As consultas continuam retornando exatamente o mesmo resultado, só que muito mais rápido e barato.

## O que está custando caro hoje

| Consulta | Chamadas | Tempo total | Causa |
|---|---|---|---|
| Busca por telefone em `oferta_ativa_leads` (3 ILIKE) | 417 mil | ~121 h | Sem índice → varre a tabela toda |
| Busca por telefone simples em `oferta_ativa_leads` | 126 mil | ~55 h | Mesmo problema |
| Tarefas por lead+status em `pipeline_tarefas` | 1,4 milhão | ~58 h | Falta índice composto |
| `v_user_partner_leads` (parcerias) | 5,3 milhões | ~21 h | Chamada com muita frequência |

## Mudanças (somente índices — aditivas e reversíveis)

### 1. Índice de busca por telefone (`oferta_ativa_leads`)
Criar índices trigram (GIN) nas colunas usadas nas buscas `ILIKE %...%`: `telefone`, `telefone_normalizado` e `telefone2`. Isso elimina a varredura completa nas duas consultas mais caras da lista (juntas ~176 h/mês). Requer a extensão `pg_trgm` (padrão do Postgres, só habilitar).

### 2. Índice composto em `pipeline_tarefas`
Criar índice em `(pipeline_lead_id, status, vence_em, hora_vencimento)` — exatamente o padrão da 3ª consulta mais cara (filtra por lead + status e ordena por vencimento). Acaba com os 145 ms médios por chamada.

### 3. Reduzir chamadas de `v_user_partner_leads`
A view de parcerias é consultada na carga do pipeline e em outras telas. Como é uma view, o ganho maior vem de **reduzir a frequência das chamadas no frontend** (cache/menos polling) em vez de só indexar. Proponho, nesta etapa, apenas **investigar e ajustar o cache** dessa chamada em `usePipeline` sem mudar o resultado exibido — e só aplicar se for comprovadamente seguro. Se houver qualquer risco de quebrar a lógica de parcerias, deixo de fora.

## Ordem de execução
1. Migração 1: habilitar `pg_trgm` + índices trigram em `oferta_ativa_leads`.
2. Migração 2: índice composto em `pipeline_tarefas`.
3. Validar com `EXPLAIN` que os índices estão sendo usados e reconferir as consultas lentas.
4. (Opcional, com cautela) ajustar cache de `v_user_partner_leads` no frontend.

## Detalhes técnicos
- Índices via `CREATE INDEX` dentro do migration tool (sem `CONCURRENTLY`, que não roda em transação de migração). As tabelas são pequenas/médias, então a criação é rápida.
- Nenhuma coluna, tabela, policy ou dado é alterado — risco operacional mínimo e totalmente reversível (`DROP INDEX`).
- Respeitando a regra de no máx. 2 migrações/dia em horário comercial: as duas migrações de índice cabem nesse limite.

## Resultado esperado
Queda expressiva no tempo de compute e no egress dessas consultas, permitindo manter a instância **Large** com folga (ou avaliar **Medium** depois). Sem nenhuma mudança visível para os usuários do CRM.