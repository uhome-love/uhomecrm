## Ajuste de cores da borda do card no Pipeline

Atualizar o mapa `SIDEBAR_BY_STATUS` em `src/components/pipeline/CardMinimal.tsx` para seguir a semântica que o usuário pediu:

| Estado da tarefa | Cor da borda |
|---|---|
| Futura (em dia) | 🟩 verde (`emerald-500`) |
| Hoje, ainda não venceu | 🟩 verde (`emerald-500`) |
| Hoje, hora já passou (atrasada) | 🟥 vermelha (`red-500`) |
| Atrasada (vence_em < hoje) | 🟥 vermelha (`red-500`) |
| Sem tarefa pendente | 🟨 amarela (`amber-500`) |
| Negócio criado / convertido | 🟦 azul (`sky-500`) |
| Descarte | cinza (mantém) |

### Detalhes técnicos

- A função `resolveStatus` já trata "hoje + hora passou" como `"atrasada"`, então basta mexer no mapa de cores:
  - `hoje` → `before:bg-emerald-500` (era amber)
  - `sem` → `before:bg-amber-500` (era slate-300)
  - `convertido` → `before:bg-sky-500` (era `before:bg-primary` indigo)
- Mantém `atrasada` vermelho, `futura` verde, `descarte` cinza.
- Nada muda em `taskBuckets.ts`, KPIs, filtros ou Central de Tarefas — é só a faixa lateral visual do card.

Resultado: corretor vê verde enquanto está em dia (inclusive tarefas de hoje), vermelho só quando realmente venceu, amarelo chama atenção para leads sem tarefa, azul destaca negócios.
