# Clientes sem próximo passo: mostrar etapa e última ação

## Pedido do corretor
Na lista "Clientes sem próximo passo" (página Tarefas), ver a **etapa do Pipeline** e o **dia da última ação feita**, para decidir rápido a próxima tarefa.

## Como fica cada cliente
```text
Arthur Lake                                   [Abrir lead] [+ Criar tarefa]
Open Bosque · 🔎 Qualificação · Última ação: há 6 dias (09/10)
```
- Etapa com o mesmo ícone e nome do Pipeline.
- Última ação: "hoje", "ontem" ou "há X dias (dd/mm)". Sem nenhuma ação: "Sem ação registrada".
- Ação há mais de 7 dias fica em vermelho, para chamar atenção.
- Ordem da lista: quem está há mais tempo sem ação aparece primeiro.

## O que não muda
- Quem entra na lista continua igual (clientes ativos sem tarefa pendente).
- Botões "Abrir lead" e "Criar tarefa" iguais. Nada muda nas regras, nos números da Roleta nem no banco.

## Como vou validar
- Abrir a página Tarefas no preview, aba "Sem próximo passo", conferir etapa e data de alguns clientes contra o Pipeline. Só leitura, nenhum cliente alterado.

## Detalhes técnicos
- `useSemProximoPasso` (`src/hooks/useMinhasTarefas.ts`): select passa a trazer `stage_id, ultima_acao_at`; reaproveita o mapa de `pipeline_stages` já buscado para anexar nome/tipo da etapa; ordena por `ultima_acao_at` asc (nulos primeiro).
- `SemProximoPasso.tsx`: segunda linha com empreendimento · etapa · última ação (datas em BRT); ícone da etapa vindo do helper já usado no Pipeline (`leadHelpers.ts`).
- Sem migration, sem edge function.
