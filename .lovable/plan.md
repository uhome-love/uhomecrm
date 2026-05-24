# Drawer Wide v4 — Abas Tarefas e Visitas (editorial)

Reformulação visual das abas Tarefas e Visitas do drawer, mantendo a linguagem editorial da aba Histórico (v4). Sem mexer em queries, hooks, telemetria, Sprint 1 ou Dashboard v3. Sequências sugeridas HOMI/Lia ficam para fase futura (removidas da aba por ora).

## Arquivos novos

1. **`src/lib/taskGrouping.ts`** (~60 linhas)
   - `groupTasksByDeadline(tarefas)` → buckets `atrasadas | hoje | amanha | semana | proximas`
   - `formatTaskDeadline(vence_em)` → "Vencida há X dias" / "Hoje · HH:MM" / "Amanhã · HH:MM" / "Sexta · 27 Mai · HH:MM" / "27 Mai · HH:MM"
   - Usa `parseDateBRT` / `formatBRT` existentes (regra global BRT)

2. **`src/lib/visitGrouping.ts`** (~30 linhas)
   - `groupVisitsByStatus(visitas)` → `{ agendadas, realizadas }` (futuro vs passado em BRT)

3. **`src/components/pipeline/drawer/DrawerTasksTab.tsx`** (~260 linhas)
   - Header "Tarefas" + subtítulo dinâmico (X atrasada · Y hoje · Z próximas) + botão indigo "+ Nova tarefa"
   - 5 grupos com header uppercase colorido + count chip; grupos vazios omitidos
   - Card por tarefa com:
     - ícone 32px em círculo (cor por tipo: call=red, msg=indigo, followup=purple, visit=emerald, outro=zinc)
     - bg + borda lateral 3px (vermelho/âmbar/branco neutro)
     - prazo + badge tipo + título + descrição opcional
     - ações inline: Feito (primário) / Adiar / Editar / 🗑
   - Empty state com ícone, copy e CTA "+ Criar tarefa"
   - Reusa props existentes (`onToggleTarefa`, `onDeleteTarefa`, `onAddTarefa`)
   - Edit abre `EditTaskDialog` existente (se não existir, abre o NewTaskDialog em modo edição via state)

4. **`src/components/pipeline/drawer/DrawerVisitsTab.tsx`** (~250 linhas)
   - Header "Visitas" + subtítulo dinâmico (X agendada · Y realizadas) + botão "+ Agendar visita"
   - 2 grupos: Agendadas (futuras) / Realizadas (passadas)
   - Card com caixa de data 56px (gradient verde futuro / cinza passado), hora, badge status (Confirmada/Pendente/Realizada/Cancelada), empreendimento, endereço com 📍
   - Ações contextuais: futuras (Ver mapa / Confirmar / Reagendar / Editar) vs passadas (Ver observações / Status interesse)
   - Empty state com ícone 📍, copy persuasivo e CTA "+ Agendar primeira visita"
   - Reusa hook de visitas já consumido por `OpportunityVisitasTab`

## Arquivos editados

5. **`src/components/pipeline/PipelineLeadDetail.tsx`**
   - Substituir `<TabsContent value="tarefas">` para usar `DrawerTasksTab` (remover bloco de Sequências sugeridas dessa aba — fica para fase futura)
   - Substituir `<TabsContent value="visitas">` para usar `DrawerVisitsTab` (remover header inline e `OpportunityVisitasTab`)
   - Conectar callbacks: `onNovaTarefa`, `onAgendarVisita` → handlers já existentes (`setNextActionOpen`, `setScheduleVisitOpen`)
   - Sem mudanças em queries, hooks ou outras tabs

## Não mexer

- Aba Histórico (já v4 OK)
- Coluna esquerda do drawer
- `LeadTarefasTab.tsx` e `OpportunityVisitasTab.tsx` legados (ficam no projeto caso outras telas usem; só não são mais renderizados pelo drawer)
- Hooks `useLeadData`, queries Supabase
- Sprint 1, Dashboard v3, telemetria

## Decisões (recomendações do brief, aplicadas)

- Tarefas muito vencidas mantêm borda vermelha
- Edit em **modal** (reusa `EditTaskDialog` se existir; senão usa NewTaskDialog hidratado)
- Sequências HOMI/Lia removidas das abas no v4; voltam em fase futura
