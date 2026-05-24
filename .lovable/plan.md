## Substatus no Card — Achados + Plano

### Investigação no schema

**Não existem** colunas `tentativas`, `visita_status`, `pos_visita_status`, `negocio_status` em `pipeline_leads`. Tudo o que o drawer chama "Status da Etapa" vive em **um único campo JSONB**: `pipeline_leads.flag_status` (já presente em `PipelineLead.flag_status`, já trafegado em `usePipeline`).

A estrutura desse JSONB varia por `stage.tipo`. Já está toda mapeada em `src/components/pipeline/LeadFlagBadges.tsx` — vou **reusar a mesma fonte de verdade** para o card, em vez de inventar nomes novos.

### Mapa real `flag_status` por stage

| Stage.tipo | Chaves do JSON | Valores possíveis |
|---|---|---|
| `sem_contato` | `tentativas` (string "0".."7") | contador X/7 |
| `contato_inicial` | `impressao`, `intencao` | `gostou` / `nao_gostou`; `morar` / `investir` |
| `busca` | `status_busca` | `busca_pendente` / `imoveis_enviados` |
| `aquecimento` | `prazo` (string dias) | "3", "7", … |
| `visita` | `status_visita` | `marcada` / `realizada` / `no_show` / `reagendada` |
| `pos_visita` | `feedback_coletado`/`simulacao_enviada`/`objecoes_mapeadas` ("sim"), `interesse` (`alto`/`medio`/`baixo`) | combinatório |
| outros (`novo_lead`, `negociacao`, `proposta`, `assinatura`, `descarte`, `convertido`) | — | sem flag estruturada hoje |

**Importante:** "Negócio Criado" não tem substatus em `pipeline_leads` — o status comercial fica em `negocios` (`vendido` / `perdido` etc.) e o card de negócio é o `NegocioCard` separado. Para os leads em estágios de fechamento dentro do pipeline, não há badge — comportamento atual preservado.

### Plano de implementação

**Novo helper `getLeadSubstatusBadge(flagStatus, stageTipo)`** em `src/lib/leadHelpers.ts` retornando **um único** `{ label, className } | null` para caber compacto no header do card. Prioridade (quando há múltiplos sinais no mesmo stage, escolhe o mais "operacional"):

- `sem_contato` → "☎️ X/7" (vermelho se ≥5, âmbar se ≥3, cinza)
- `contato_inicial` → `intencao` (Morar/Investir) > `impressao` (Gostou/Não gostou)
- `busca` → `status_busca`
- `aquecimento` → `⏰ Xd`
- `visita` → `status_visita` (Marcada/Realizada/No-show/Reagendada)
- `pos_visita` → `interesse` (🔥 Alto / 🟡 Médio / ❄️ Baixo); fallback para `feedback_coletado=sim` → "💬 Feedback"
- demais → `null`

Cores via Tailwind tokens (`bg-red-100 text-red-700`, `bg-amber-100 text-amber-700`, `bg-emerald-100 text-emerald-700`, `bg-indigo-100 text-indigo-700`, `bg-purple-100 text-purple-700`, `bg-zinc-100 text-zinc-600`).

**`CardMinimal.tsx`:** inserir o badge no header entre o bloco do nome (flex-1) e o `CardOverflowMenu`. Estrutura: `flex items-start gap-1.5 min-w-0`, badge `shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-tight`. Nome continua truncando primeiro. Quando helper retorna `null`, nada renderiza (sem placeholder).

### Não toca

- `LeadFlagBadges` (continua sendo usado em outros lugares; novo helper é independente e compacto).
- `LeadFlagControls`, drawer, `NegocioCard`, queries, types do banco.
- DnD, menu, ordenação.

### Aceite

- Badge aparece à direita do nome, antes do `···`.
- Stages sem flag preenchida não mostram nada.
- Cores semânticas conforme spec.
- Build limpo.

Aguardando GO.
