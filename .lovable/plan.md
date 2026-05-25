## Problema

No painel "Roleta — turno X" do Dashboard do Gerente, corretores que estão credenciados em mais de um turno (ex.: Leo Dorneles em Manhã + Tarde, Luiza Clós, Thalia) aparecem como cards duplicados — um por turno. Visualmente parece que existem mais pessoas do que há de fato.

## Solução (somente UI, sem mexer em backend)

Agrupar os credenciados por `corretor_id` no `V4PanelRoleta` e renderizar **um único card por corretor**, listando dentro dele todos os turnos que ele participa com a contagem de leads de cada turno.

### Formato do card consolidado

```text
┌──────────────────────────────────────────┐
│ [avatar•]  Leo Dorneles                  │
│            Manhã · 2  ·  Tarde · 2       │
└──────────────────────────────────────────┘
```

- Nome do corretor em destaque (igual hoje).
- Linha secundária: `Manhã · X leads · Tarde · Y leads · Noite · Z leads`, mostrando apenas os turnos em que ele realmente está credenciado, separados por `·`.
- Bolinha verde de "online" continua aparecendo se **qualquer** um dos turnos do corretor estiver ativo agora (`turno_ativo_agora === true` em alguma das entradas).
- Ordem dos turnos fixa: Manhã → Tarde → Noite → Dia todo.

### KPI "Credenciados agora"

Hoje mostra `ativos / total` contando entradas (turnos). Vai passar a contar **corretores distintos**:
- `ativos` = quantidade de corretores únicos com algum turno ativo agora.
- `total`  = quantidade de corretores únicos credenciados no dia.

Isso alinha o número ao novo layout (1 card = 1 pessoa).

## Arquivos afetados

- `src/components/dashboard-v4/V4PanelRoleta.tsx` — único arquivo a alterar:
  - Novo helper `groupByCorretor(credenciados)` que devolve `{ corretor_id, nome, avatar_url, turno_ativo_agora, turnos: [{janela, leads_recebidos_dia}] }`.
  - `CredCard` passa a receber esse objeto agrupado e renderizar a linha de turnos.
  - Ajustar contagem `ativos` / `credenciados.length` para usar a lista agrupada.

## Fora de escopo

- Hook `useDashboardGerenteV4Dia` e RPC do backend permanecem como estão (continuam retornando 1 linha por turno; o agrupamento é feito no cliente).
- Outros painéis do dashboard, página `/roleta`, fluxo de credenciamento.
