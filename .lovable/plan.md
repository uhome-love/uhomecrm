# Auditoria + unificação do fluxo de criação de visitas

## Cenário atual

Mapeei todos os pontos do app que fazem `INSERT` em `visitas`:

| # | Origem | Componente / Modal | Resolve `gerente_id` real? | Grava `pipeline_lead_id`? | Aparece na Agenda? | Aparece na aba Visitas do lead? |
|---|---|---|---|---|---|---|
| 1 | Agenda de Visitas (botão +) | `VisitaForm` → `useVisitas.createVisita` | ✅ via `team_members` | ✅ | ✅ | ✅ |
| 2 | Drawer do Lead (aba Visitas) **e** card do pipeline | `CardScheduleVisitDialog` (modal próprio, reduzido) | ❌ grava `gerente_id = user.id` | ✅ | ✅ p/ corretor / ❌ some pro gerente | ✅ |
| 3 | WhatsApp Inbox → "Agendar visita" no chat | `ConversationThread.handleScheduleVisit` (modal próprio) | ❌ grava `gerente_id = authUid` | ✅ | ✅ p/ corretor / ❌ some pro gerente | ✅ |
| 4 | Oferta Ativa (DialingMode + DialingModeWithScript) | `createVisitaFromOA` em `useVisitas.ts` (sem modal — inline) | ✅ via `team_members` | ❌ **só grava `lead_id` (oferta_ativa)**, não grava `pipeline_lead_id` | ✅ | ❌ não aparece na aba do drawer |
| 5 | Negócio → Reunião | `NegocioDetailModal` (modal próprio, tipo reunião) | ✅ usa `gerente_id` do negócio | n/a (vincula `negocio_id`) | ✅ | ✅ na aba do negócio |
| 6 | Modo Foco (CallFocusOverlay) | — não tem modal próprio; abre o drawer → cai no #2 | — | — | — | — |

A aba "Visitas" do drawer (`DrawerVisitsTab`) filtra **só por `pipeline_lead_id`**.
A Agenda (`useVisitas`) filtra por `corretor_id` (e por `gerente_id` nas views do gerente).
Daí o impacto exato descrito acima.

## Decisão de arquitetura

**Modal único e universal** = `VisitaForm` (o da Agenda de Visitas), usado em todos os pontos com botão "Agendar visita", chamando sempre `useVisitas.createVisita` (que já resolve `gerente_id` via `team_members`, valida campos, normaliza data/hora BRT, e atualiza progressão do lead). Isso elimina os 3 modais paralelos e os bugs de `gerente_id`.

Ganhos:
- Padrão visual e UX iguais em todo lugar.
- Um único caminho de insert → uma única fonte de bugs/manutenção.
- Resolve automaticamente os bugs #2, #3 e #4 (mantém invariantes: gerente certo + pipeline_lead_id preenchido).

## O que vou fazer

### 1. Drawer do Lead + Pipeline Card (`PipelineLeadDetail` e onde mais usa `CardScheduleVisitDialog`)
- Substituir `CardScheduleVisitDialog` por `VisitaForm` com `initialData` pré-preenchido a partir do lead (`nome_cliente`, `telefone`, `empreendimento`, `pipeline_lead_id`, `corretor_id`).
- Passar `onSubmit = createVisita` do `useVisitas`.
- Após sucesso, manter o comportamento atual: invalidar queries e mover o lead pro stage de "Visita marcada" se a origem for o card.
- Deletar `CardScheduleVisitDialog.tsx` (não há outros usos além desses dois).

### 2. WhatsApp Inbox (`ConversationThread.tsx`)
- Substituir o modal interno e o `handleScheduleVisit` (insert direto) por `VisitaForm` + `createVisita`.
- `initialData` pré-preenchido com `pipeline_lead_id`, `nome_cliente`, `telefone`, `empreendimento`, `corretor_id`.
- Após sucesso, manter o auto-preenchimento da mensagem de confirmação no chat e o avanço de stage para "Visita marcada".

### 3. Oferta Ativa (`DialingMode.tsx` e `DialingModeWithScript.tsx`)
- Para o fluxo inline (quando o corretor já marca tipo + data/hora no card de resultado), manter a chamada atual mas ajustar `createVisitaFromOA`:
  - Aceitar parâmetro opcional `pipelineLeadId`.
  - Quando não vier, tentar resolver: buscar em `pipeline_leads` por telefone normalizado (últimos 8 dígitos) + `corretor_id`.
  - Gravar `pipeline_lead_id` no payload quando resolvido. → resolve #4.
- Para o botão "📅 Agendar Visita" (modal explícito), usar `VisitaForm` com `initialData` pré-preenchido + `createVisita`, em vez de criar inline.

### 4. Negócio (`NegocioDetailModal`)
- **Manter o modal atual de Reunião como está** (fluxo de negócio tem campos específicos: `tipo_reuniao`, `negocio_id`, etc., e o `gerente_id` já vem certo do negócio). Não force `VisitaForm` aqui — risco de regressão sem ganho real. *(Confirmar com o usuário se prefere unificar mesmo assim.)*

### 5. Limpeza
- Remover `CardScheduleVisitDialog.tsx` após migração.
- Remover modal interno de visita do `ConversationThread.tsx`.

## O que NÃO vou mexer

- `useVisitas.createVisita` — já está correto.
- `VisitaForm` — só vai receber novos pontos de uso.
- Schema do banco / RLS / Edge functions.
- Layout do drawer, do chat e da OA fora do modal de visita.

## Validação

- Drawer do lead → agendar → aparece na Agenda do corretor **e** do gerente, aparece na aba Visitas do lead.
- Card do pipeline → mesma checagem + lead muda de stage.
- WhatsApp Inbox → mesma checagem + mensagem de confirmação preenche no chat.
- Oferta Ativa (inline + botão "Agendar") → aparece na Agenda **e** na aba Visitas do lead correspondente no pipeline.
- Modo Foco → herda do drawer (já coberto).

Posso seguir?
