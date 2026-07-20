# Motor de Próxima Ação — Visita + Histórico do Lead (auditoria e padronização)

## Estado atual (verificado agora no banco e no código)

### Tarefas em paralelo na etapa Visita
- 204 leads na etapa Visita.
- Apenas **2 leads** têm tarefa manual pendente ao lado da nova `visita_auto`:
  - **Louie**: `Visita: Louie · 25/07` (manual, `origem=NULL`) + `Confirmar visita — Louie` (`visita_auto`).
  - **Patrícia Rosa**: `Visita: Patrícia Rosa · 22/07` (manual) + `Confirmar visita — Patrícia Rosa` (`visita_auto`).
- Renan (print 2) hoje tem só 1 pendente no banco (`Confirmar visita — 25/07 10:00`). O "Follow-up 20/07 21:00" era resíduo de tarefa já concluída em 15/07.

### Causa raiz do risco futuro
Existem **dois triggers de entrada em Visita** rodando lado a lado em `pipeline_leads`: `trg_visita_stage_entry` (fn `trg_visita_stage_entry_fn`) e `trg_visita_stage_entry_tarefa` (fn `fn_visita_stage_entry_tarefa`). Ambos criam tarefa "Agendar/Atualizar visita" quando o lead entra na etapa. Se não for consolidado, cada movimento pra Visita corre o risco de gerar duas tarefas.

### Histórico do lead — o que já entra e o que falta
Fonte do timeline: `LeadHistoricoTab.tsx` cruza `pipeline_atividades`, `pipeline_tarefas`, `visita_eventos`, `pipeline_historico` (mudanças de etapa) e `lead_imovel_events`.

Problemas verificados no print do Renan:
- Linha "Tarefa criada: Confirmar visita — por Adriana — 17:21" **não mostra o vencimento da tarefa nem sinaliza que foi criada pelo fluxo automático**. O gestor não sabe se é ação manual do corretor ou automação. Também não aparece o subtipo.
- "Tarefa criada: Follow-up" (13/07) idem — sem data de vencimento, sem contexto.
- "Visita agendada" aparece 2× seguidos no mesmo instante (uma vinda de `pipeline_atividades`, outra vinda de `visita_eventos`). Ruído puro.
- Não há linha explícita quando o lead **muda de etapa** (Qualificação → Visita, etc.), embora `pipeline_historico` tenha o dado.
- Não há linha padronizada de "Tarefa cancelada / expirada" — só criada e concluída.
- Visual: cabeçalho "Hoje / Sábado / 13 de Jul" bom, mas dentro do dia falta uma faixa lateral de agrupamento por autor/tipo e a hora está solta em cinza claro. Cards não usam tokens semânticos consistentes (mistura `bg-green-100`, `bg-blue-100` hardcoded — quebra o design system dark/tokens).

## Fase 1 — Consolidação backend (uma migration)

1. **Um único trigger de entrada em Visita.** Manter `trg_visita_stage_entry_tarefa` + `fn_visita_stage_entry_tarefa` (é o que o backfill de Fase B usou). `DROP` do legado `trg_visita_stage_entry` + `trg_visita_stage_entry_fn`.
2. **Cancelar tarefas manuais órfãs** dos leads em Visita: `status='pendente'`, `origem IS NULL`, `tipo='visita'`, existe uma `visita_auto` pendente pro mesmo lead. Só marca `cancelada`, não deleta. Loga em `pipeline_atividades` uma linha `tipo='sistema'` "Tarefa manual duplicada cancelada — mantida a automação" pra aparecer no timeline.
3. Rodar `fn_reconciliar_visita_auto()` no final pra garantir 1 `visita_auto` pendente por lead em Visita.
4. **Reforçar deduplicação de "Visita agendada"**: `logVisitaEvento` de `pipeline_atividades` deixa de inserir quando `visita_eventos` já tiver o mesmo evento no mesmo minuto (matamos a linha duplicada na fonte, backfill retroativo remove os 1203 duplicados que criamos na Fase B).

Impacto: 2 tarefas canceladas hoje (Louie + Patrícia); trigger duplicado eliminado; timeline sem mais entradas gêmeas de "Visita agendada".

## Fase 2 — Rótulo real da tarefa no card do Kanban (`CardMinimal.tsx` + `formatNextAction.ts`)

Quando `proximaTarefa.origem === 'visita_auto'`, o card usa mapa por `subtipo` em vez de "Follow-up":

| subtipo                    | rótulo                |
| -------------------------- | --------------------- |
| `confirmar_visita`         | Confirmar visita      |
| `atualizar_visita`         | Atualizar agenda      |
| `agendar_visita`           | Agendar visita        |
| `reagendar_visita`         | Remarcar visita       |
| `pegar_feedback`           | Alinhar pós-visita    |
| `decidir_descarte_visita`  | Decidir descarte      |
| `definir_sequencia`        | Definir próxima ação  |

Sufixo temporal (`hoje 10:00`, `em 5 dias`, `atrasada`) segue idêntico. Nenhuma outra etapa muda.

## Fase 3 — Histórico do lead: auditoria + padronização visual

**A. Conteúdo (o que cada linha precisa mostrar)**

1. **Tarefa criada** → título + subtítulo com **vencimento + origem**:
   > `Tarefa criada: Confirmar visita`
   > `Vence 25/07 às 10:00 · Fluxo automático da Visita`
   Origem exibida como pill discreta ao lado do título: `🤖 Automação` (quando `origem` começa com `visita_auto` / `qualificacao_` / `nurturing_` / etc.) ou `👤 Manual` quando `origem IS NULL`. Autor real (corretor) fica no rodapé.
2. **Tarefa concluída** → título + resultado (Respondeu / Não respondeu / Outro) + observação + tempo até conclusão ("concluída 2h após criação").
3. **Tarefa cancelada / expirada** → linha nova, tom neutro/warning, sem inflar o timeline (agrupa em "N tarefas canceladas hoje" quando há mais de 2 no mesmo dia).
4. **Mudança de etapa** → puxa de `pipeline_historico` uma linha "Movido: Qualificação → Visita — por Adriana", ícone GitBranch, tom indigo. Hoje só entra se alguém escreveu manualmente em `pipeline_atividades`; passa a entrar automático.
5. **Atribuição/repasse** → linha "Repassado para Fulano — motivo X" (usa `pipeline_historico` de `corretor_id`).
6. **Visita** → uma única linha por evento (agendada / status alterado / data alterada / resultado registrado), com imóvel + data + hora + autor. Dedup por minuto + tipo.
7. **Descarte / reativação / inativação / arquivo** → linha destacada com tom próprio.
8. **Nota manual** → mantém como está, mas ganha ícone de post-it e destaque de "nota interna".

**B. Ordenação e agrupamento**
- Timeline continua descendente por `created_at`.
- Cabeçalhos: `Hoje`, `Ontem`, `Esta semana` (dia da semana), depois `DD/MM/AAAA`. Formato BRT via `formatBRT` centralizado (regra do projeto).
- Dentro do dia, agrupar linhas do mesmo tipo consecutivas do mesmo autor num único card expansível quando >3 (evita spam de "Tarefa criada" quando o motor gera várias no mesmo segundo).

**C. Visual (design tokens, sem hardcode de cores)**
- Migrar `bg-green-100 text-green-600`, `bg-blue-100 text-blue-600` etc. para tokens semânticos (`bg-success/10 text-success`, `bg-primary/10 text-primary`, `bg-warning/10 text-warning`, `bg-destructive/10 text-destructive`, `bg-muted text-muted-foreground`) — obriga a respeitar tema dark do projeto.
- Cada linha: avatar/ícone tipado à esquerda (com halo suave), título em `text-sm font-medium`, subtítulo em `text-xs text-muted-foreground`, badges (Automação/Manual/Resultado) inline com o título, hora BRT alinhada à direita em tom mudo.
- Linha vertical do timeline usa `border-border`, ponto do evento no `bg-primary/20`, tarefas concluídas em `bg-success/20`, tarefas canceladas em `bg-muted`.
- Cabeçalho de cada seção (Hoje etc.) fica sticky no topo da lista com `bg-background/80 backdrop-blur` — leitura confortável na rolagem.
- Contador "13 eventos · 1 nota" ganha filtro rápido: chips no topo — `Tudo · Tarefas · Visitas · Etapas · Notas` — para o gestor focar no que quer ver sem perder o histórico completo.

**D. Fonte única (código)**
- Extrair montagem do timeline para um hook `useLeadTimeline(leadId)` que retorna itens já normalizados, tipados e deduplicados. `LeadHistoricoTab.tsx` vira apresentação pura. Facilita reutilizar em drawer, print/PDF de 1:1 e futura view do CEO.

## Validação depois do build

1. SQL antes/depois:
   ```
   SELECT count(*) FROM pipeline_tarefas pt
   JOIN pipeline_leads pl ON pl.id=pt.pipeline_lead_id
   JOIN pipeline_stages ps ON ps.id=pl.stage_id
   WHERE ps.tipo='visita' AND pt.status='pendente';
   ```
   Antes: 206. Depois: 204 (só `visita_auto`).
2. Abrir Louie e Patrícia → só 1 tarefa pendente; timeline mostra "Tarefa manual duplicada cancelada".
3. Mover lead de teste pra Visita → cria **uma** tarefa (trigger consolidado).
4. Card do lead na coluna Visita: "Confirmar visita — em 5 dias", "Alinhar pós-visita — hoje 10:00" etc.
5. Renan (print) — histórico exibe:
   - `Tarefa criada: Confirmar visita — Vence 25/07 às 10:00 · 🤖 Automação — por Adriana — 17:21`
   - `Visita agendada — 26/07 14:30 · Casa Tua Qualificado v2 — por Adriana — 12:49` (uma só linha, não duas)
   - `Movido: Qualificação → Visita — por Adriana — 12:49`
6. Filtro por chips funciona; agrupamento de eventos consecutivos aparece quando >3 no mesmo segundo.

## Fora do escopo (não mexe)

- Outras etapas do pipeline continuam com o timeline atual — só reaproveitamos o novo hook progressivamente.
- Não deletamos histórico concluído; só cancelamos duplicatas ativas e removemos linhas gêmeas retroativas de `pipeline_atividades` criadas pela Fase B.
- Se aparecer tarefa manual pendente em Visita **sem** contraparte `visita_auto`, mantemos (é intenção legítima do corretor).
