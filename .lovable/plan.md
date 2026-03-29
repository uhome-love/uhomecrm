

## Reorganizar layout: Meta do Dia + Tarefas lado a lado, Funil + Evolução abaixo

### Mudança

Apenas reordenar blocos JSX em `CorretorDashboard.tsx`. Zero alteração de lógica.

### Layout atual (linhas 337-371)

```
Agenda + Visitas (lado a lado)
Funil + Evolução (lado a lado)
Meta do Dia (full width)
```

### Layout novo

```
Meta do Dia + Agenda/Tarefas (lado a lado, grid md:grid-cols-2)
   └─ Esquerda: DailyProgressCard (Meta do Dia)
   └─ Direita: MinhaAgendaWidget (Agenda/Tarefas)

Meu Funil + Últimos 7 dias (lado a lado, grid md:grid-cols-2) — mantém como está
   └─ Esquerda: MiniFunilPessoal
   └─ Direita: EvolucaoSemanal
```

- O bloco `VisitasHojeCard` fica acima (antes das Oportunidades) ou é removido se redundante — mantemos dentro da Agenda como já está integrado.

### Arquivo alterado

`src/pages/CorretorDashboard.tsx` — mover o bloco `DailyProgressCard` (linhas 364-371) para ficar lado a lado com `MinhaAgendaWidget` (linhas 340-349), substituindo o grid atual de Agenda+Visitas. O bloco Funil+Evolução (linhas 354-358) fica logo abaixo.

Ordem final da seção:
1. `grid md:grid-cols-2`: `DailyProgressCard` (esquerda) + `MinhaAgendaWidget` (direita)
2. `VisitasHojeCard` (condicional, full width, se houver visitas)
3. `grid md:grid-cols-2`: `MiniFunilPessoal` (esquerda) + `EvolucaoSemanal` (direita)

