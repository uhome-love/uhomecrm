# Tarefas: "Sem próximo passo" vira uma aba

## Minha dica
Concordo, a caixa amarela em cima de todas as abas tira o foco do que importa (as tarefas do dia). Sugiro transformar em uma aba própria, mas sem esconder o problema:

```text
[ Vencidas 27 ] [ Hoje 3 ] [ Próximas 7 ] [ Novas 1 ] [ Sem próximo passo 8 ] [ Concluídas ]
                                                       ^ número em laranja quando tem cliente
```

- A caixa amarela sai do topo da página.
- Nova aba **"Sem próximo passo"** mostra a lista de clientes, cada um com "Criar tarefa" e "Abrir lead" (igual hoje, mas em tela cheia, sem o "Ver todos").
- O número da aba fica em laranja quando tem algum cliente, então o corretor continua vendo que existe pendência, só que sem poluir.
- Quando criar a tarefa, o cliente sai da aba e o número diminui na hora.
- Se não tiver nenhum: "Todos os seus clientes têm próximo passo. Muito bem!"
- O comunicado de amanhã já fala "a página mostra quem está sem próximo passo" e continua certo.

## Depois de aprovado
1. Fazer a mudança.
2. Testar no preview com a conta de corretor e um cliente de teste (aparece na aba, criar tarefa, sai da aba) e apagar o teste.

## Detalhes técnicos
- `TarefasCorretor.tsx`: nova aba local `sem_passo` (fora de `AbaTarefa` do hook), remove o bloco `<SemProximoPasso>` do topo e renderiza a lista quando essa aba está ativa; só na visão "minhas tarefas".
- `SemProximoPasso.tsx`: modo lista completa (sem limite de 3 e sem "Ver todos").
- Sem mudança no banco.
