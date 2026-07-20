
# Fluxo Fixo da Etapa Visita — Plano

## 1. Inventário confirmado (leituras diretas)

**Tabela `public.visitas`** (fonte única da agenda):
- Campos-chave: `pipeline_lead_id` (FK para o lead), `data_visita` (date), `hora_visita` (time), `status`, `resultado_visita`, `corretor_id`, `created_by`.
- Valores reais de `status` em produção hoje: `marcada`, `confirmada` (implícito no código, ainda não observado nos dados), `realizada`, `no_show`, `reagendada`, `cancelada`.
- Tela que registra: `src/pages/AgendaVisitas.tsx` (edição livre) e ações rápidas em `useVisitas.ts` (`updateVisita` faz UPDATE direto). Não existe outra porta de entrada.

**Ponte visita ↔ pipeline (já existente):**
- Trigger `trg_visita_status_pipeline` (função `visita_status_to_pipeline`) roda `AFTER INSERT OR UPDATE OF status, resultado_visita ON visitas`. Ele **move o lead** entre stages (`visita_marcada`, `visita_realizada`, `atendimento`, `negociacao`, `descarte`, `qualificacao`). Ou seja, o CRM já reage à agenda de visitas hoje — só falta a criação de tarefa.
- Também temos `trg_notify_visita_criada` e `trg_notify_visita_confirmada` só para notificações.

**Automação de tarefa a partir de visita:** nenhuma. `rg pipeline_tarefas` cruzado com `visita|feedback|confirmar|reagend` em `supabase/migrations/` retornou vazio. Clean slate.

**Precedente arquitetural:** o Sem Contato já usa trigger de banco (`_pipeline_tarefas_cap_30d` + trigger de cadência) — é o padrão que o dono do produto pediu ("como o Sem Contato faz").

**Convenção de origem de tarefa:** `pipeline_tarefas.origem` já é usado (`'cadencia_sem_contato'`). Reservar `'visita_auto'` como marca da automação.

**Etapas do pipeline envolvidas:** existem dois tipos de stage — `visita_marcada` (pré-visita) e `visita_realizada` (pós-visita). Ambos são "etapa Visita" no board mental do usuário. Isso importa para: **o AgendarCard manual precisa ser escondido nos DOIS**.

---

## 2. Arquitetura recomendada: trigger de banco (não front)

**Recomendação:** um único trigger `AFTER INSERT OR UPDATE OF data_visita, hora_visita, status ON public.visitas` chamando uma função `visita_auto_tarefas()`.

**Por que trigger e não front:**
- A tabela `visitas` é atualizada por múltiplas superfícies (AgendaVisitas, ações do card, edge functions de confirmação por WhatsApp, futuro Google Calendar sync). Se a lógica ficar no front, cada superfície precisa lembrar de disparar — é como falhamos no Sem Contato antes.
- Precisa funcionar mesmo quando o corretor edita a visita pelo mobile, ou quando o cron de confirmação muda o status.
- Idempotência é natural no banco (transação + `UPDATE ... WHERE`).
- Espelha o padrão já aprovado do Sem Contato.

**Lógica dos 3 gatilhos**, dentro de `visita_auto_tarefas()`:

```text
guard: se NEW.pipeline_lead_id IS NULL → RETURN NEW (visita solta, ignora)
guard: se lead está em stage cujo tipo NÃO é ('visita_marcada','visita_realizada')
       após a atualização → ainda cria/cancela, porque o outro trigger
       (visita_status_to_pipeline) já vai mover o lead pra Visita.

Bloco A — CONFIRMAR VISITA (24h antes)
 dispara quando: (INSERT com status='marcada' OU status virou 'marcada'/'reagendada'/'confirmada'
                  OU data_visita/hora_visita mudaram) E data+hora >= now()
 ação:
   1) cancela toda pipeline_tarefas pendente do lead com origem='visita_auto'
      (evita duplicatas quando remarca)
   2) INSERT pipeline_tarefas:
        tipo='visita', titulo='Confirmar visita — {nome}',
        vence_em = (data_visita + hora_visita - 24h) em BRT (date),
        hora_vencimento = hora_visita,
        origem='visita_auto', origem_ref=NEW.id (nova coluna? ver §4),
        responsavel_id = NEW.corretor_id,
        status='pendente'
   3) se D-24h já passou → cria a tarefa com vence_em = hoje BRT
      (não pode nascer atrasada por default)

Bloco B — NO-SHOW (reagendar em 48h)
 dispara quando: status virou 'no_show'
 ação:
   1) cancela pipeline_tarefas pendente com origem='visita_auto' do lead
   2) INSERT pipeline_tarefas:
        tipo='follow_up', titulo='Reagendar visita — {nome}',
        vence_em = (now() + 48h) em BRT, hora_vencimento='10:00',
        origem='visita_auto', origem_ref=NEW.id

Bloco C — REALIZADA (feedback em 24h)
 dispara quando: status virou 'realizada'
 ação:
   1) cancela pipeline_tarefas pendente com origem='visita_auto' do lead
   2) INSERT pipeline_tarefas:
        tipo='follow_up', titulo='Pegar feedback da visita — {nome}',
        vence_em = (now() + 24h) em BRT, hora_vencimento='10:00',
        origem='visita_auto', origem_ref=NEW.id

Bloco D — CANCELADA
 status virou 'cancelada' → cancela pipeline_tarefas 'visita_auto' pendente,
 não cria nova (o lead saiu de Visita via o outro trigger).
```

**Interação com o cap de 30/90d:** o trigger `_pipeline_tarefas_cap_30d` continua ativo, mas as tarefas geradas por `visita_auto` sempre caem em janela curta (24h/48h). Vou adicionar `origem='visita_auto'` à lista de isenções desse cap (paralelo ao `cadencia_sem_contato`) por segurança, caso a visita seja marcada com >30 dias de antecedência.

---

## 3. Idempotência e substituição

- **Chave lógica de deduplicação:** `pipeline_tarefas.origem='visita_auto' AND origem_ref = visita.id`. Precisa de uma coluna `origem_ref uuid` em `pipeline_tarefas` (ver §4). Antes de inserir, o trigger sempre `UPDATE pipeline_tarefas SET status='cancelada' WHERE pipeline_lead_id=? AND origem='visita_auto' AND status='pendente'`. Isso cobre:
  - Salvar o status 2x seguidas → primeiro cancela pendente (não existe), depois cria; se rodar de novo cancela a recém-criada e cria idêntica. Sem UI duplicada (o "vira concluída ao confirmar" acontece porque o corretor conclui manualmente, e ao concluir a próxima automação nasce se a visita evoluir).
  - Remarcar visita (data mudou) → cancela "Confirmar visita" antiga, cria nova pro novo D-1.
  - No-show → cancela "Confirmar visita" pendente, cria "Reagendar".
  - Realizada → cancela "Confirmar visita" (se corretor esqueceu de concluir manualmente), cria "Pegar feedback".

- **Concluir manualmente** ("Confirmei com o cliente"): o corretor abre a tarefa e conclui via `TaskCompletionDialog`. Ela vira `concluida`. Se o corretor depois editar a visita, o trigger só mexe em tarefas `status='pendente'`, não ressuscita concluída. ✅

---

## 4. Mudanças de schema

Migration única:

1. `ALTER TABLE public.pipeline_tarefas ADD COLUMN IF NOT EXISTS origem_ref uuid;` — rastreia a visita/entidade de origem (não é FK dura, pra não travar delete de visita).
2. Ajustar `_pipeline_tarefas_cap_30d`: adicionar `IF NEW.origem = 'visita_auto' THEN RETURN NEW; END IF;` (já existe pra `cadencia_sem_contato`).
3. `CREATE OR REPLACE FUNCTION public.visita_auto_tarefas()` + trigger `AFTER INSERT OR UPDATE OF status, data_visita, hora_visita, resultado_visita ON public.visitas FOR EACH ROW EXECUTE FUNCTION visita_auto_tarefas();`.
4. **Backfill leve (opcional, recomendado):** para cada visita com `status='marcada'` e `data_visita >= today` sem tarefa `visita_auto` associada, criar a tarefa de confirmação. Isso evita que leads em Visita hoje continuem sem tarefa até alguém tocar a linha.

Nada de RLS novo — `pipeline_tarefas` já tem as policies certas e o trigger roda como `SECURITY DEFINER`.

---

## 5. UI — travar a etapa Visita como fluxo fixo

**Em `TaskCompletionDialog` + `CompletionForm`:** quando `stageTipo` é `'visita_marcada'` ou `'visita_realizada'`:
- Esconder o `AgendarCard` (bloco "Agendar próxima tarefa"). Mostrar banner: *"Próxima tarefa desta etapa é criada automaticamente pela Agenda de Visitas."*
- Manter os campos Resultado + Observação obrigatórios.
- **Não** exigir status pill (diferente de Qualificação/Aquecimento/Negociação) — a "próxima ação" é derivada do status da visita, não de um pill do lead.
- Botão único: **Concluir**.

**Em `AgendaVisitas.tsx`:** nada muda estruturalmente; a mera ação de mudar `status` já dispara o trigger. Se quiser um toque de UX: exibir toast "Tarefa X criada automaticamente" após o UPDATE (opcional, fase 2).

**Card do Kanban (`CardMinimal.tsx`):** já mostra `proximaTarefa.titulo` — vai exibir "Confirmar visita — Fulano" naturalmente. Sem mudança.

---

## 6. Casos de borda tratados

| Cenário | Comportamento |
|---|---|
| Visita sem `hora_visita` | Assume `10:00` para calcular D-1; documentado. |
| Visita marcada pra amanhã de manhã (D-1 já é passado) | Cria tarefa vencendo **hoje**, hora atual + 1h (nunca nasce atrasada). |
| Remarcada (`reagendada`) | Cancela pendente + cria nova "Confirmar visita" pro novo horário. |
| No-show → depois "realizada" (correção) | Cancela "Reagendar" pendente + cria "Pegar feedback". |
| Cliente respondeu "sim" pelo WhatsApp e status virou `confirmada` | Mantém a tarefa "Confirmar visita" pendente? **Decisão:** cancela (o objetivo dela — confirmar — foi cumprido) e não cria nova até status='realizada' ou 'no_show'. A "Pegar feedback" nasce quando `realizada`. |
| Visita sem `pipeline_lead_id` | Trigger sai cedo, ignora. |
| Visita `cancelada` | Cancela pendentes `visita_auto`. Lead sai da etapa Visita via o outro trigger; próxima ação passa a ser regida pela nova etapa. |

---

## 7. Detalhes técnicos (referência)

- Trigger: `AFTER INSERT OR UPDATE OF status, data_visita, hora_visita ON public.visitas`.
- Função: `public.visita_auto_tarefas()` — `LANGUAGE plpgsql SECURITY DEFINER SET search_path=public`.
- Chave de dedup: `pipeline_tarefas(origem='visita_auto', pipeline_lead_id, status='pendente')`.
- Nova coluna: `pipeline_tarefas.origem_ref uuid` (sem FK).
- Isenção no cap: `origem='visita_auto'` adicionado ao early-return de `_pipeline_tarefas_cap_30d`.
- Front: `stageTipo IN ('visita_marcada','visita_realizada')` esconde `AgendarCard` e mostra banner. Não requer status pill obrigatório.
- Testes pós-deploy (via `supabase--read_query`): (a) INSERT visita marcada com D+2 → conferir 1 tarefa `Confirmar visita` D+1; (b) UPDATE status='no_show' → conferir cancelamento da anterior + 1 "Reagendar" D+2; (c) UPDATE status='realizada' → conferir "Pegar feedback" D+1; (d) rodar (b) duas vezes → só 1 tarefa pendente.

---

## 8. Fora de escopo (para não inchar)

- Notificação push extra ao criar tarefa automática (o sistema de notificações já cobre `pipeline_tarefas` novas).
- Sincronizar com Google Calendar da tarefa (só a visita hoje tem `google_event_id`).
- Mudar textos/labels de outras etapas.
