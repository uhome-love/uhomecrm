## Refino Visual CardMinimal — Nível 2

### Resposta às decisões abertas

1. **Mapping de tipo:** o card já recebe `proximaTarefa.tipo` como **enum** (`ligacao | whatsapp | email | visita | reuniao | followup | outro`) via `usePipeline`. Não precisa parsear free-text de `lead.proxima_acao` — vou mapear o enum direto, mais robusto. `parseActionType` recebe `tipo: string | null` e retorna `'call' | 'msg' | 'followup' | 'visit' | 'outro'`.
2. **Coluna empreendimento:** é `lead.empreendimento` (string, já deduplicada via `deduplicateEmp`). Mantenho.
3. **Truncate:** sim, `truncate` no empreendimento. Pílula sempre visível, texto-quando trunca.

### Arquivos

- **`src/lib/leadHelpers.ts`** — adicionar:
  - `parseTaskActionType(tipo)` → categoria
  - constantes `ACTION_ICON`, `ACTION_LABEL`, `ACTION_PILL_CLASS` (com versão atrasada: fundo `bg-red-100 text-red-700` para call quando atrasada já é vermelha; demais ganham `ring-1 ring-red-200` se atrasada)
  - `formatTaskWhen(tarefa)` → só a parte temporal ("agora", "hoje 14:30", "amanhã", "em 3 dias", "28/05", "definir")

- **`src/components/pipeline/CardMinimal.tsx`** — re-render:
  - Linha nome: `text-[13.5px] font-semibold tracking-tight` + menu `···` sempre visível (`text-zinc-400 hover:text-zinc-600`, sem `opacity-0 group-hover`).
  - Empreendimento: `text-[11px] text-muted-foreground truncate`.
  - Telefone: `flex items-center gap-1.5` com ícone `📞` 10px cinza claro + número 11px.
  - Divisor: `border-t border-border/40`.
  - Linha de ação: pílula colorida (ícone + label) + texto-quando truncado + `Nd` à direita. Atrasada → texto bold vermelho; pílula `call` permanece vermelha (combina com status).
  - Borda lateral 4px preservada (sem mudanças em `SIDEBAR_BY_STATUS`).
  - Rodapé corretor/parceria preservado.

### Não toca

- `CardOverflowMenu` (apenas a classe do trigger se necessário — vou inspecionar para garantir que o `···` fique sempre visível; provavelmente o componente já controla isso e basta passar `className` ou ajustar lá um wrapper).
- DnD, lógica de status, `resolveStatus`, `formatNextAction` (continua disponível mas o card passa a usar a versão decomposta).
- `NegocioCard`, Sprint 1, Dashboard v3, `usePipeline`.

### Risco

- Altura sobe de ~85px para ~95px conforme spec — virtualização (`react-window` no Kanban) usa estimativa; vou checar se há `itemSize` fixo. Se sim, ajusto.

Aguardando GO.
