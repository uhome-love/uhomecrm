# Por que "tem leads na Oferta Ativa" sem nenhuma lista ativa

## O que os dados mostram (consultado agora no banco)

Não existe nenhuma campanha ativa: das 20 listas mais recentes, todas estão `arquivada`, exceto uma `[TESTE]` já `encerrada` em 01/08. Mesmo assim:

```text
Leads ainda vinculados a listas ARQUIVADAS ...... 12.341   (1.409 ainda como "na fila")
Leads em listas encerradas ......................        5
Base Única marcada "na_oferta_ativa" ............ 11.688 (+517 "ambos")
```

Ou seja, os números que você vê vêm de **duas heranças**, não de campanha ativa:

1. Quando as 65 listas antigas foram arquivadas, os leads delas **não** foram desligados — 12.341 registros continuam em `oferta_ativa_leads`, e 1.409 seguem com status "na fila" de uma lista que não existe mais na operação.
2. O rótulo `situacao_crm = 'na_oferta_ativa'` da Base Única é uma foto da importação; ele marca quem *um dia* esteve numa lista, não quem está numa campanha ativa. Por isso o KPI "Já na Oferta Ativa" mostra ~11,7 mil.

Efeito colateral relevante: a higiene da criação de campanha exclui quem tem registro ativo em `oferta_ativa_leads` — então esses 1.409 fantasmas estão sendo bloqueados de entrar em campanhas novas sem motivo.

## Correção proposta

### Fase 1 — Encerrar os leads órfãos (1 migração DML)
- Todo lead em `oferta_ativa_leads` cujo `lista_id` aponta para lista `arquivada`/`encerrada` e ainda está "na fila" passa para status encerrado/liberado (sem DELETE, histórico de tentativas preservado).
- Limpar entradas correspondentes em `oferta_ativa_fila` de listas não ativas.

### Fase 2 — Rótulo da Base Única deixar de mentir
- `atualizar_situacao_crm_base_leads()` recalcula `na_oferta_ativa` considerando **apenas** listas com status `liberada` e dentro da janela; quem só tem histórico volta a ser `inedito` ou `no_pipeline` conforme o caso.
- Rodar uma vez e manter no agendamento diário.

### Fase 3 — KPI honesto na tela
- Na Base Única, separar "Em campanha ativa agora" de "Já trabalhado em campanha anterior", para o painel refletir a operação real.

### Fase 4 — Validação
Conferir por SQL que sobra zero lead "na fila" fora de campanha ativa, e que a prévia de campanha do Casa Tua passa a liberar os leads que estavam presos.

## Detalhes técnicos
- Só `oferta_ativa_leads`/`oferta_ativa_fila` e a função de recálculo; nada de DELETE, nada no Mutirão ao vivo, nada em `pipeline_leads`.
- Fases 1 e 2 numa única migração (DML + função), Fase 3 é frontend (`BaseLeadsPage.tsx` + `useBaseLeads.ts`).
