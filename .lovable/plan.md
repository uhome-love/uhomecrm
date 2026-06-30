## Objetivo
Três melhorias na página **Leads Estagnados** (`/leads-estagnados`):
1. Botão **"Devolver ao corretor"** — devolve o lead estagnado ao próprio corretor que o perdeu (quando o cliente volta a responder).
2. **Filtro por etapa** na barra de filtros.
3. Ao **repassar** para outro corretor, o lead sempre vai para a etapa **Novo Lead** (melhor visualização para quem recebe).

## Mudanças no banco (1 migração — funções, sem alterar tabelas/RLS)

**`decidir_lead_estagnado`** ganha:

- **Nova ação `devolver`**: mantém o `corretor_id` atual (o corretor que perdeu o lead), tira de estagnação (`estagnado=false`, limpa `estagnado_em/aviso/prazo`), desarquiva (`arquivado=false`), `aceite_status='aceito'`, `aceito_em=now()`, e move para a etapa **Novo Lead** (`d3843b2f-2fa1-4c31-9129-4eb0ed21f019`) com `stage_changed_at=now()` e `ultima_acao_at=now()`. Registra no `pipeline_historico` ("Estagnação: devolvido ao corretor — cliente retornou."). Permissão: mesma regra atual (admin/diretor global; gestor só própria equipe).
- **Ação `repassar` ajustada**: além do que já faz, passa a setar `stage_id = Novo Lead` + `stage_changed_at=now()`, para o lead aparecer no topo do pipeline do novo corretor. (Hoje ela mantém a etapa antiga.)

Demais ações (`roleta`, `descartar`) ficam iguais.

## Mudanças no frontend

**`src/hooks/usePipelineEstagnacao.ts`**
- Adicionar `"devolver"` ao tipo `AcaoEstagnacao`.
- Incluir label de sucesso para `devolver` ("Lead devolvido ao corretor.").

**`src/pages/LeadsEstagnados.tsx`**
1. **Filtro por etapa**: novo `Select` (igual ao de empreendimento), populado dinamicamente a partir de `baseRows` (campo `l.etapa`), com estado `etapaFilter`; integrado ao `rows` (filtro), ao `hasFilters` e ao "Limpar", e resetado no `handleTabChange`.
2. **Botão "Devolver ao corretor"**:
   - No `LeadRow` (ação individual), adicionar botão `Devolver` (ícone `Undo2`/`RotateCcw`) que chama `onDecide("devolver")`. Exibido apenas quando `lead.corretor_id` existe.
   - Na barra de seleção múltipla, adicionar botão **Devolver** equivalente.
   - No `DecisionDialog`: tratar `acao === "devolver"` — sem seletor de corretor de destino, com texto explicativo ("O lead volta para {corretor} na etapa Novo Lead"), label no `ACAO_LABELS`, e botão de confirmação padrão. O fluxo de `handleConfirm` já é genérico (não envia `corretorDestino` quando não é repassar).

## Detalhes técnicos
- `ACAO_LABELS` ganha `devolver: "Devolver ao corretor"`.
- Reuso total do hook `useDecidirEstagnado` e do RPC `decidir_lead_estagnado` (apenas mais um valor de `p_acao`).
- Sem novas tabelas, sem mudança de RLS, sem edge function.
- A regra de estagnação (arquivamento, reset por ação/tarefa futura) permanece intacta; `devolver` e `repassar` apenas desarquivam e reposicionam na etapa Novo Lead.

### Validação após aplicar
- Devolver um lead estagnado → confirmar que volta ao mesmo corretor, na etapa Novo Lead, fora da estagnação e visível no pipeline.
- Repassar → confirmar que aparece no novo corretor na etapa Novo Lead.
- Filtro por etapa → confirmar que filtra corretamente e combina com os demais filtros.
