## Diagnóstico

### Bug 1 — erro ao regredir (`42703 · new has no field motivo_queda`)
Confirmado no banco: o trigger `trg_pdn_mirror_negocio` em `public.negocios` referencia `NEW.motivo_queda`, mas a coluna **não existe** em `negocios` (só existe em `pdn_entries`).

Fluxo do erro ao clicar em "Regredir":
1. `UPDATE pipeline_leads SET stage_id=<visita>` (via `syncPipelineStageFromPdn`).
2. Dispara `trg_clear_negocio_on_stage_regress` → `UPDATE negocios SET status='arquivado'`.
3. Dispara `trg_pdn_mirror_negocio` → lê `NEW.motivo_queda` inexistente → **42703** → transação inteira aborta → toast "Erro ao mover lead no pipeline".

Colateral: `discardLeadFromPdn` e `inactivateLeadFromPdn` já tentam escrever `negocios.motivo_queda` e falham silenciosamente hoje.

### Bug 2 — refresh infinito no /pdn
`src/hooks/pdn/usePdnLive.ts` assina **todo UPDATE em `pipeline_leads`** e chama `refreshAll()`. Como `loadDeals()` e `loadEntries()` fazem `setLoading(true)`, o componente cai no estado "loading" e remonta tudo. Em produção há rajadas constantes de UPDATEs (crons, integrações, outros usuários), então a página nunca fica quieta.

## Plano

### 1. Migration — destravar o UPDATE (Bug 1)
```sql
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS motivo_queda text;
```
Sem novas policies/grants (herda de `negocios`). Sozinho já faz o botão "Regredir" voltar a funcionar.

### 2. UI — diálogo de regressão com motivo + etapa alvo + aviso ao corretor (Bug 1)
Novo `src/components/pdn/PdnRegredirDialog.tsx`, mesmo padrão visual de `PdnQuedaDialog`. Substitui os dois `window.confirm` do botão "Regredir" em `PdnGestor.tsx` (linhas 1044‑1048 e 1147‑1151).

Conteúdo do diálogo:
- Cabeçalho: "Regredir <nome> no pipeline".
- **Selecionar etapa destino**: só as etapas anteriores válidas ao grupo atual (Contrato → Em Negociação/Visita Realizada; Ganho → Contrato/Em Negociação/Visita Realizada). Default = etapa imediatamente anterior.
- **Motivo obrigatório** (textarea, mín. 3 caracteres). Botão desabilitado até preencher.
- Nota: "O corretor será notificado da regressão e do motivo."
- Botões: Cancelar / Confirmar regressão.

### 3. Backend do sync — propagar o motivo (Bug 1)
Ajustar `syncPipelineStageFromPdn` em `src/lib/pdnSyncEngine.ts`:
- Nova assinatura opcional: `syncPipelineStageFromPdn(row, grupo, userId, opts?: { motivo?: string })`.
- Se `opts.motivo` presente **e** `isRegressao === true` **e** houver `negocioId`: gravar `motivo_queda = opts.motivo` no `negocios` **antes** do `UPDATE pipeline_leads` (para que o trigger de mirror veja o valor).
- Anexar o motivo à `observacao` de `pipeline_historico` e à mensagem de `notifyBroker` (categoria `pdn_regressao`, título "PDN: etapa regredida para X").

### 4. Wiring em `PdnGestor.tsx` (Bug 1)
- Novo state `regredirRow: { row: PdnRow; grupoAtual: PdnGrupo } | null`.
- Botões "Regredir" (desktop e mobile) abrem o diálogo em vez de `window.confirm`.
- Ao confirmar, chamar `mudarEtapa(row, grupoDestino, { motivo })`. Estender `mudarEtapa` em `src/hooks/usePdn.ts` para repassar `opts` (retrocompatível — sem `opts` mantém comportamento atual).

### 5. Estancar o refresh infinito (Bug 2)
Duas mudanças combinadas:

**5a. `src/hooks/usePdn.ts` — separar first-load de refresh silencioso**
- Adicionar flag interna `hasLoadedOnceRef` em `loadDeals` e `loadEntries`.
- Só chamar `setLoadingDeals(true)` / `setLoadingEntries(true)` na primeira carga. Refetches em background rodam sem tocar o `loading` global (a UI já mostra os dados antigos até chegar o novo; sem remount, sem spinner de tela cheia).

**5b. `src/hooks/pdn/usePdnLive.ts` — filtrar e desacelerar**
- Aumentar `DEBOUNCE_MS` de 3 s → 10 s e `MIN_INTERVAL_MS` de 5 s → 30 s.
- No handler de `pipeline_leads`, inspecionar `payload.new` vs `payload.old` e só agendar refresh se **algum** destes campos mudou: `stage_id`, `arquivado`, `negocio_id`, `corretor_id`, `motivo_descarte`. UPDATEs que só mexem em `ultima_acao_at`, `updated_at`, `flag_status`, `lead_score` etc. são ignorados.
- Manter INSERT em `visita_eventos` como está (baixa frequência).
- Pausar o schedule quando `document.hidden === true` (evita refresh em abas em background).

### 6. Validação (obrigatória antes de fechar)
- Regredir Contrato → Em Negociação com motivo "teste plano" em lead real de teste:
  - Sem erro no console; toast de sucesso.
  - `pipeline_leads.stage_id` mudou; `pipeline_leads.negocio_id` = NULL.
  - `negocios.status='arquivado'` e `motivo_queda='teste plano'`.
  - `pdn_entries` refletiu via trigger (sem marcar "caiu").
  - Notificação criada para o corretor com o motivo.
- Testar Ganho → Visita Realizada (pula 2 etapas).
- Cancelar o diálogo → nada muda.
- "Marcar como caiu" continua abrindo `PdnQuedaDialog` (não foi tocado).
- Deixar `/pdn` aberto por ~2 minutos: a tela não deve remontar ("piscar") mesmo com atividade no backend; mudanças reais de etapa continuam refletindo em até ~10 s.

## Fora de escopo
- Sem mudanças em `PdnQuedaDialog` (queda continua fluxo separado).
- Sem mudanças em RLS/policies.
- Sem mudanças no fluxo de avanço de etapa (só regressão pede motivo).