# Onda 0 — Fundação do Motor de Atividade (Parte A + Parte B)

Investigação feita no código e no banco reais. Nada foi alterado.

---

## PARTE A — Descarte canônico

### 1. Como o descarte funciona hoje (arquivos reais)

- `src/components/pipeline/DiscardLeadDialog.tsx` — diálogo do card do Kanban. Lista de motivos **hardcoded como texto** no JSX (linhas 128-133): "Contato errado", "Não quer mais contato", "Solicitou retirada do nome", "Sem perfil", "Sem retorno", "outro".
- `src/components/pipeline/PipelineLeadDetail.tsx` (linhas ~968-975) — **segundo** seletor de motivos, também hardcoded em texto.
- `src/components/pipeline/task-completion/types.ts` (linhas 140-155) — `DESCARTE_REASONS` e `INATIVAR_REASONS`, com `code` + `label` (a única lista com código estável hoje). Consumida por `TaskCompletionDialog.tsx`, `CompletionForm.tsx` e `NextActionModal.tsx`.
- `src/components/pipeline/PipelineStageTransitionPopup.tsx` (linhas 737-738) — **terceira** lista, com códigos próprios (`nao_atende`, `sem_perfil`) que não batem 100% com a de `types.ts`.
- `src/lib/leadOutcome.ts` — helper único que monta o texto final (`"Descartado: ..."` / `"Inativado: ..."`).
- Outros gravadores: `src/lib/negocioQueda.ts`, `src/components/pipeline/FocusModeModal.tsx`, `src/components/pipeline/BulkActionModal.tsx`, `src/components/pipeline/LeadTarefasTab.tsx`, `src/lib/taskCompletion.ts`, `src/lib/visitaResultadoRouting.ts`, `src/lib/pdnSyncEngine.ts` e edges (`sweep-descartados`, `_shared/reactivateLead.ts`, `oferta-ativa-*`, `reengajamento-*`).

### 2. Existem listas divergentes? Sim — quatro

`DiscardLeadDialog` (texto puro) · `PipelineLeadDetail` (texto puro) · `task-completion/types.ts` (code+label) · `PipelineStageTransitionPopup` (códigos próprios). Não há nenhum arquivo único de constantes de motivo.

### 3. Reengajável vs inativar hoje

Existe sim: `pipeline_leads.tipo_descarte` (text, nullable) com valores `reengajavel` / `definitivo`, mais `arquivado` (boolean, default false) para o definitivo. O texto em `motivo_descarte` carrega o prefixo redundante.

Dado real do banco (contagem por prefixo × tipo) mostra o problema: `Descartado`/reengajável 1.728, `Inativado`/definitivo 997, mas também **151 "Inativado" marcados como reengajável** e **129 "Descartado" marcados como definitivo**, além de dezenas de textos livres (`nao atende`, `sem perfil`, `Limpeza automática`, `duplicado_merge`, textos de sweep com data anexada). Ou seja: `motivo_descarte` é texto livre poluído e não serve para agrupar.

### 4. Plano proposto — Parte A

1. Novo arquivo `src/lib/discardReasons.ts`: constante única `DISCARD_REASONS` com `{ code, label, emoji, tipo: 'reengajavel' | 'definitivo' }` — construída a partir dos motivos que já existem em produção (união das 4 listas), preservando os `code` já usados em `task-completion/types.ts` para não invalidar nada.
2. Migration única (1 só):
   - `ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS motivo_descarte_code text;`
   - índice parcial `WHERE motivo_descarte_code IS NOT NULL`;
   - backfill **somente derivado** (classifica o texto legado nos codes conhecidos por padrão de texto; o que não casar fica NULL). `motivo_descarte` e `tipo_descarte` não são tocados — histórico 100% intacto.
3. Frontend passa a gravar `motivo_descarte_code` + `tipo_descarte` derivado da constante, e continua gravando `motivo_descarte` texto via `buildMotivoDescarte` (compatibilidade com tudo que hoje lê texto).

Arquivos a tocar: `src/lib/discardReasons.ts` (novo), `DiscardLeadDialog.tsx`, `PipelineLeadDetail.tsx`, `PipelineStageTransitionPopup.tsx`, `task-completion/types.ts` (re-exporta da constante única), `FocusModeModal.tsx`, `BulkActionModal.tsx`, `NextActionModal.tsx`, `src/lib/taskCompletion.ts`, `src/lib/negocioQueda.ts`.

Migrations: **1**. Riscos: baixo — coluna nova nullable; único risco é o backfill classificar errado algum texto ambíguo, mitigado por deixar NULL quando não houver certeza e por não alterar nenhuma coluna existente. Nenhuma leitura atual quebra.

---

## PARTE B — `ultimo_toque_at` + combustível

### 1. Colunas

- `ultima_acao_at`: existe, `timestamptz`, nullable, **default now()**.
- `ultimo_toque_at`: **não existe**.

Achado crítico que confirma a hipótese do Motor de Atividade: existe o trigger `trg_update_lead_ultima_acao` (`BEFORE UPDATE ON pipeline_leads FOR EACH ROW`) executando `update_lead_ultima_acao()`, que faz `NEW.ultima_acao_at := now()` em **qualquer** UPDATE da linha — mudança de flag, sync de CAPI, empreendimento canônico, PDN, qualquer coisa. Por isso quase todo lead parece "em dia".

### 2. Pontos que escrevem `ultima_acao_at` hoje (lista completa)

Banco: trigger `trg_update_lead_ultima_acao` (pega todo UPDATE) + RPCs/migrations que setam explicitamente (`20260729020618` ×4, `20260428181656`, `20260428181722`, `20260514003109`, `20260513195921`, `20260511134950`).

Edge functions: `oferta-ativa-registrar-resultado` (L168), `oferta-ativa-proximo-lead` (L65), `site-events` (L143). (As ocorrências em `oferta-ativa-participantes` e `oferta-ativa-ranking` são de outra tabela — participantes do mutirão — não de `pipeline_leads`.)

Frontend: `FocusModeModal.tsx` (L497, L610), `task-completion/VisitaCompletionFlow.tsx` (L214), `DiscardLeadDialog.tsx` (L70, L89), `CallFocusOverlay.tsx` (L215), `usePipelineLeadData.ts` (L120, L147, L189), `usePipeline.ts` (L669 e ~L909), `MinhasTarefas.tsx` (L591, L595, L705), `DialingModeWithScript.tsx` (L364), `WhatsAppTemplatesDialog.tsx` (L123, L144), `WhatsAppFocusFlow.tsx` (L154), `LeadTarefasTab.tsx` (L182, L282), `useLeadProgression.ts` (L24, L65, L96, L113, L183), `LeadSequenceSuggestion.tsx` (L125), `LeadHistoricoTab.tsx` (L548), `QuickActionMenu.tsx` (L53), `useEstagnadoLeadDrawer.ts` (L107), `NextActionModal.tsx` (via `createNextTask`).

### 3. Onde `ultimo_toque_at` deveria ser escrito

(a) **Atividade manual**: `LeadHistoricoTab.tsx` (L546-548), `QuickActionMenu.tsx` (L44-55), `src/lib/taskCompletion.ts`, `src/lib/completeLeadTask.ts`, `MinhasTarefas.tsx` (L579-595), `FocusModeModal.tsx`.
(b) **WhatsApp enviado pelo corretor**: no CRM o envio manual não passa por edge function — o corretor abre o wa.me e o registro acontece em `WhatsAppFocusFlow.tsx` (L154) e `WhatsAppTemplatesDialog.tsx` (L123/L144); no canal oficial, `supabase/functions/evolution-webhook/index.ts` (L545, evento de mensagem *outbound*) e `_shared/metaSend.ts` (usado por `whatsapp-notificacao` / `whatsapp-campaign-dispatch`). **Campanha/reengajamento em massa NÃO deve marcar toque** — é disparo automático, não trabalho do corretor.
(c) **E-mail**: não existe envio de e-mail 1:1 por corretor no código atual (Mailgun aparece só em campanha de marketing). Ponto mais próximo: `src/hooks/useComunicacao.ts` (L102, `comunicacao_historico`). Item (c) fica sem hook por ora — não existe.
(d) **Ligação registrada**: `CallFocusOverlay.tsx` (L215), `DialingModeWithScript.tsx` (L364), `oferta-ativa-registrar-resultado` (L168), `CustomListAttemptModal.tsx`.
(e) **Visita realizada**: `task-completion/VisitaCompletionFlow.tsx` (L214) e `src/lib/visitaResultadoRouting.ts`.

**Excluir explicitamente (IA não é toque)**: `supabase/functions/whatsapp-ai-reply/index.ts` — L166-170 grava `ai_replied = true` e L174 insere em `pipeline_atividades`. Esse caminho, e a chamada que o dispara em `whatsapp-webhook/index.ts` (L1247-1255), não podem escrever `ultimo_toque_at`. Também ficam de fora: `nurturing-orchestrator`, `whatsapp-campaign-dispatch`, `reengajamento-*`, `receive-*` (entrada de lead) e `site-events`.

### 4. Plano proposto — Parte B

1. Migration única (1 só):
   - `ALTER TABLE public.pipeline_leads ADD COLUMN IF NOT EXISTS ultimo_toque_at timestamptz;` (nullable, **sem default**, **sem trigger**);
   - índice `(ultimo_toque_at DESC NULLS LAST)`;
   - backfill não-quebrável, uma vez: maior toque real conhecido por lead — `GREATEST` entre a última `pipeline_atividades` de tipo humano (ligação/whatsapp/email/visita/proposta), a última tarefa concluída, `primeiro_contato_em` e, em último caso, `created_at`. Nunca nasce nulo.
2. Escrita nos pontos (a), (b-manual/outbound), (d), (e) — sempre **junto** com o `ultima_acao_at` já existente, nunca no lugar dele. Ideal: helper `src/lib/registrarToque.ts` para um único ponto de verdade, chamado pelos arquivos da seção 3.
3. **Nada de régua**: estagnação, "atrasado" e Modo Foco continuam lendo `ultima_acao_at` nesta onda. Ligar a régua no campo novo é Onda 1, depois de comparar os dois campos em produção por alguns dias.

Arquivos a tocar: `src/lib/registrarToque.ts` (novo) + os listados em (a), (b), (d), (e). Migrations: **1**.

Riscos: baixo. Coluna nova nullable + backfill de UPDATE em massa em `pipeline_leads` — este é o único ponto que toca produção de forma pesada: como `trg_update_lead_ultima_acao` dispara em todo UPDATE, **o backfill vai reescrever `ultima_acao_at = now()` de todos os leads tocados**, distorcendo a métrica atual de estagnação. Mitigação obrigatória: no backfill, setar `ultima_acao_at` de volta ao valor anterior no mesmo UPDATE (o trigger é BEFORE e sobrescreve, então a alternativa é `ALTER TABLE ... DISABLE TRIGGER trg_update_lead_ultima_acao` durante o backfill e reabilitar na mesma transação). Sem isso, o backfill é destrutivo para o dado atual. Segundo risco menor: volume do UPDATE — fazer em lotes.

---

## Ordem de build recomendada

1. **Parte A** (descarte canônico) — mais contida, 1 migration, sem risco de dado destrutivo. Confirma sua intuição.
2. **Parte B** (`ultimo_toque_at`) — 1 migration com o cuidado do trigger no backfill, depois os hooks de escrita em 1-2 builds pequenos.
3. Só depois, Onda 1: ligar a régua de saúde no `ultimo_toque_at`.

Teto de 2 migrations/dia respeitado: A e B podem sair no mesmo dia (1 + 1), mas recomendo dias separados para validar o backfill de B com calma.
