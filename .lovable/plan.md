
# Fechamento do incidente de fase legada — plano formal

Investigação read-only concluída. Nenhuma alteração aplicada nesta rodada.

## Parte 0 — Distinção que muda tudo

Antes das listas, uma descoberta importante que muda a classificação de muita coisa:

- **`negocios.fase`** (banco): só aceita canonicamente `em_negociacao | contrato | ganho`. Não tem CHECK constraint — grava qualquer string em silêncio (é a causa do risco de "fantasma").
- **`pipeline_stages.tipo`** (banco): ainda usa `proposta`, `contrato_gerado`, `venda` (confirmado por `SELECT DISTINCT tipo FROM pipeline_stages`). São 10 tipos válidos e **não são a mesma coisa** que `negocios.fase`.
- **`tarefa.tipo`, `atividade.tipo`, `notification.tipo`**: universos próprios, aceitam `proposta`, `negociacao`, `enviar_proposta` etc como categoria/rótulo, **sem** tocar `negocios.fase`.

**Consequência**: dezenas de ocorrências de `"proposta"`, `"negociacao"`, `"documentacao"` que a varredura devolve NÃO são bug — são `stage.tipo` ou `tarefa.tipo` legítimos. Só entra no plano quem compara/grava contra `negocios.fase`.

## Parte 1 — Levantamento

### 1.1 Confirmação canônica do banco
```
fase           count
em_negociacao  203
contrato       2
ganho          96

status     count
ativo      135
perdido    131
arquivado  35
```
Zero linhas em `vendido`, `assinado`, `novo_negocio`, `proposta`, `negociacao`, `documentacao`, `distrato`. Sem CHECK constraint.

### 1.2 AddNegocioDialog — o que grava hoje

Confirmado por leitura do arquivo:
- Default do state (linha 43): `fase: "em_negociacao"` ✅ (canônico)
- Array `FASES` do dropdown (linha 27-31): oferece `novo_negocio | proposta | negociacao | documentacao` — legado
- INSERT (linha 91): `fase: form.fase` — grava o que estiver selecionado

**Diagnóstico**: se o usuário abre e submete sem tocar no dropdown, grava `em_negociacao` (ok). Se toca no dropdown, grava fantasma. É bug ativo, mas com "escape hatch" no default — provavelmente por isso os 203 `em_negociacao` do banco existem em vez de estarem cheios de `novo_negocio`.

**Valor canônico correto**: mostrar apenas as 3 fases reais (`em_negociacao`, `contrato`, `ganho`). Raciocínio: um usuário criando negócio manual normalmente entra em "em negociação" (proposta em aberto), mas em casos de importação/backfill pode querer criar já em "contrato" ou "ganho" (venda que aconteceu fora do sistema).

### 1.3 Varredura completa src/ + supabase/functions/

Total bruto: 300 hits. Classificados por risco (só o que toca `negocios.fase` real):

#### 🔴 A — ESCRITA em `negocios.fase` (grava fantasma)

| # | Arquivo:linha | Valor atual | Canônico correto | Justificativa |
|---|---|---|---|---|
| A1 | `src/components/pipeline/NegocioDetailModal.tsx:271` | `onMoveFase(id, "distrato")` | remover botão OU chamar fluxo de queda (`status='perdido'`, não `fase`) | `distrato` não existe. Queda deve setar `status='perdido'` via `applyNegocioQueda`, mantendo fase atual. |
| A2 | `src/components/pipeline/AddNegocioDialog.tsx:27-31` | dropdown `novo_negocio/proposta/negociacao/documentacao` | `em_negociacao / contrato / ganho` | Já explicado em 1.2 |

**Só existem esses 2 pontos de escrita fantasma no código.** Todos os outros writes descobertos hoje (12 arquivos da rodada anterior) já estão corrigidos.

#### 🟠 B — LEITURA/FILTRO contra `negocios.fase` (retorna vazio silenciosamente)

**Frontend:**

| # | Arquivo:linha | Filtro atual | Canônico correto | Impacto |
|---|---|---|---|---|
| B1 | `useGerenteDashboard.ts:331-336` | `negFases = ["proposta","negociacao","assinado"]`; funil push `"proposta"`, `"assinado" + "vendido"` | remontar funil com `["em_negociacao","contrato","ganho"]` | Colunas "Proposta" e "Assinado" do gerente mostram **0 hoje** (confirmado por leitura) |
| B2 | `useCeoData.ts:175` | comentário `assinado/vendido by data_assinatura` | atualizar código de referência (é comentário, mas denuncia que a query real perto pode filtrar errado — precisa reler linhas 170-260 antes de descartar) | investigar |
| B3 | `RelatorioNegocios.tsx:50,156,158` | `["ganho","perdido","distrato"]` para excluir de "ativos" | `["ganho"]` (perdido já sai via `status`; distrato não existe) | Superestima "ativos" incluindo status=perdido; VGV pipeline inflado |
| B4 | `RelatorioVendas.tsx:48` | `if (fase === "distrato") return "Caiu"` | remover branch morto | inofensivo (nunca dispara) |
| B5 | `PipelineBoard.tsx:403` | `FASES_OCULTAS = new Set(["distrato","perdido","cancelado","n"])` | verificar se filtra `negocios.fase` ou `pipeline_leads.stage` — provavelmente stage, então irrelevante | investigar antes de mexer |
| B6 | `metricDefinitions.ts:117` | `NEGOCIO_FASES_PERDIDO = ['perdido','cancelado','distrato']` | verificar consumidores; se filtra `negocios.fase`, trocar por filtro em `status='perdido'` | investigar consumidores |
| B7 | `V4PanelNegocios.tsx:17-20` | map de cor por fase legada (`novo_negocio/proposta/negociacao/documentacao`) | 3 canônicas | painel mostra cor default para os 203+2+96 registros — não quebra, só perde cor |

**Edge functions (verdadeiramente mais perigosas — rodam sem UI de teste):**

| # | Arquivo:linha | Filtro atual | Canônico correto | Impacto |
|---|---|---|---|---|
| B8 | `homi-ceo/index.ts:344-376,454` | 6 filtros contra `"novo_negocio"`, `"proposta"`, `"negociacao"`, `"documentacao"`, `"vendido"`, `"assinado"` | 3 canônicas + status | Todo relatório executivo do HOMI CEO devolve **zero para tudo** hoje (VGV assinado, projetado, contagens por gerente) |
| B9 | `homi-gerencial/index.ts:248-272` | mesmo padrão de B8 | idem | Relatório do HOMI Gerencial também zerado |

**Não há outros pontos server-side.** `stalled-deals-notify` foi verificado — não usa nomes legados no filtro. `generate-monthly-report` opera sobre `checkpoint_lines`, não sobre `negocios.fase`.

#### 🟢 C — DISPLAY/LABEL (rótulo em UI, não filtra)

Baixo risco, corrige em lote último:

- `useVendaRealtimeNotification.ts:15,38` — 2 comentários stale (`"assinado" or "vendido"`)
- `NegocioDetailModal.tsx:177,582,629` — 3 comentários stale (`quando vendido`)
- `useLeadIntelligence.ts:153` — `s.tipo === "assinado"` — **é `stage.tipo`, não `fase`**; precisa verificar se `stage.tipo="assinado"` ainda existe. Confirmado: NÃO existe em `pipeline_stages` (só `venda`). Branch morto, remover.

#### ⚪ D — COMENTÁRIO / NOME DE VARIÁVEL / CANONICALIZADOR (zero risco)

Vistos e descartados conscientemente:

- `src/lib/negocioFase.ts:4,41,45-48` — canonicalizador aceita legado por design (correto)
- `src/hooks/usePdn.ts:33,46,48` — canonicaliza legado (correto)
- `src/lib/pdnSyncEngine.ts:16` — comentário
- `src/integrations/supabase/types.ts:12925-13088` — enum auto-gerado; regenera na próxima migration
- `taskPresets.ts`, `taskPresets.test.ts`, `taskCompletion.ts`, `MinhasTarefas.tsx`, `useComunicacao.ts`, `TemplatesComunicacao.tsx`, `useMarketplace.ts`, `SimuladorFinanciamento.tsx`, `MinhaAgendaWidget.tsx`, `SaudeOperacao.tsx`, `PipelineKanban.tsx:370`, `useNegociosCount.ts:27`, `usePdn.ts:241`, `leadHelpers.ts:185-186`, `visitaResultadoRouting.ts:30-88`, `completeLeadTask.ts:86`, `leadScoring.ts:18`, `useCorretorKpisCarteira.ts:71`, `taskQueryUtils.ts:289-290`, `PdnGestor.tsx:78,446`, `V4PanelNegocios.tsx` (outros usos), rankings/relatórios com nomes de coluna (`vgv_assinado` é NOME DE CAMPO, não valor de fase), `homi-assistant/index.ts:303`, `funnel-coach/index.ts:57` (variável), `ceo-advisor/index.ts:65-66` (prompt)

**Total categoria D: ~50 ocorrências. Todas verificadas, nenhuma toca `negocios.fase` como comparação ou gravação.**

### 1.4 `useGerenteDashboard` — impacto numérico exato

Linhas 331-336 constroem o final do funil comercial do gestor:
- push `{key:"proposta", count: negCounts["proposta"] || 0}` → **hoje sempre 0** (banco não tem `fase='proposta'`)
- push `{key:"assinado", count: (negCounts["assinado"] || 0) + (negCounts["vendido"] || 0)}` → **hoje sempre 0**

Valor correto para o gestor logado (com `profileId` como `gerente_id` e `status='ativo'`):
- "Em Negociação" (`fase='em_negociacao'`)
- "Contrato" (`fase='contrato'`)
- "Ganho" (`fase='ganho'`)

Precisa também revisar linha 322 (query) — só busca `status='ativo'`, então "Ganho" só entra se o negócio não foi arquivado. É o comportamento correto.

## Parte 2 — Plano de correção

### Ordem de aplicação (risco decrescente)

**Fase 1 — Edge functions (server-side, sem UI de teste)**
1. `supabase/functions/homi-ceo/index.ts` — reescrever `buildPdnGlobal` (linhas 341-390) e o bloco por gerente (linhas 449-461) usando 3 canônicas + `status='perdido'`
2. `supabase/functions/homi-gerencial/index.ts` — reescrever `buildPdnSummary` (linhas 244-280) idem

*Teste:* invocar cada função pelo painel do HOMI (CEO e Gerencial), pedir "resumo" e conferir se números batem com `SELECT count(*), sum(coalesce(vgv_final,vgv_estimado)) FROM negocios WHERE fase='ganho' AND status='ativo'`.

**Fase 2 — Escritas fantasma no frontend**
3. `NegocioDetailModal.tsx:271` — trocar `onMoveFase(id, "distrato")` por chamada ao fluxo de queda (`applyNegocioQueda` ou seta `status='perdido'` mantendo `fase` atual)
4. `AddNegocioDialog.tsx:26-31` — dropdown com 3 fases canônicas

*Teste:* criar negócio de teste via AddNegocioDialog em cada uma das 3 fases; conferir `fase` no banco. Depois, no drawer, testar o botão de "caiu" e conferir que grava `status='perdido'` (não `fase='distrato'`).

**Fase 3 — Leituras que zeram silenciosamente**
5. `useGerenteDashboard.ts:331-336` — 3 canônicas + labels certos
6. `RelatorioNegocios.tsx:50,156,158` — usar `status` em vez de `fase='distrato'`; remover `distrato` do array
7. `RelatorioVendas.tsx:48` — remover branch `distrato`
8. `V4PanelNegocios.tsx:17-20` — map de cor com 3 canônicas
9. **Investigação antes de mexer** (podem ser inofensivos): `PipelineBoard.tsx:403`, `metricDefinitions.ts:117` — confirmar se filtram `negocios.fase` ou outra coluna; se for outra coluna, marcar como D
10. **Investigação antes de mexer**: `useCeoData.ts:175` — reler contexto das linhas 160-270 (o comentário stale pode denunciar filtro real errado)

*Teste:* abrir dashboard do gerente logado como usuário com equipe; conferir que "Em Negociação/Contrato/Ganho" mostram números coerentes com `SELECT fase, count(*) FROM negocios WHERE gerente_id=<id> AND status='ativo' GROUP BY fase`.

**Fase 4 — Display/comentários (baixo risco)**
11. Sweep de comentários stale (categoria C): `useVendaRealtimeNotification.ts:15,38`, `NegocioDetailModal.tsx:177,582,629`
12. `useLeadIntelligence.ts:153` — remover branch `s.tipo === "assinado"` (stage tipo inexistente)

*Teste:* nenhum — só cosmético.

**Fase 5 — Categoria D**
Nenhuma ação. Já classificada como zero-risco.

## Parte 3 — Nada fica "para depois"

Todas as 4 fases acima entram no mesmo pacote de aprovação. Nenhum item depende de decisão de produto: rótulos das 3 fases já foram definidos ("Em Negociação", "Contrato", "Ganho") na consolidação de ontem à noite. Nenhuma fase precisa de aprovação de texto separada.

## Parte 4 — Verificação final proposta

Executar após todas as 5 fases aplicadas:

1. `rg -nw "vendido|distrato|novo_negocio|assinado" src/ supabase/functions/` — resultado esperado: só canonicalizador (`negocioFase.ts`, `usePdn.ts`), enum auto-gerado (`types.ts`), nome de coluna (`vgv_assinado`), e prompts textuais dos HOMIs.
2. **Teste ponta a ponta manual** (usuário Lucas conduz, eu narro os passos):
   - Criar negócio de teste via AddNegocioDialog → conferir no banco `fase='em_negociacao'`
   - Mover para "Contrato" pelo drawer → banco: `fase='contrato'`
   - Marcar como "Ganho" pelo drawer → banco: `fase='ganho'`, `status='ativo'`, `data_assinatura` preenchida
   - Marcar outro negócio como "caiu" → banco: `status='perdido'`, `fase` mantida (não vira `distrato`)
3. Dashboard do gerente (`/gerente-dashboard`) → funil comercial mostra números não-zero em "Em Negociação/Contrato/Ganho"
4. Invocar HOMI CEO pedindo resumo do PDN → texto do prompt contém números não-zero coerentes com banco
5. Deletar o negócio de teste ao final

## Guarda-corpo do banco (proposta adicional, não bloqueante)

Como a causa raiz do risco é a ausência de CHECK constraint em `negocios.fase`, sugiro após a Fase 5 uma migration curta:

```sql
ALTER TABLE negocios ADD CONSTRAINT negocios_fase_canonica
  CHECK (fase IN ('em_negociacao','contrato','ganho'));
```

Isso vira o safety net — mesmo se um caminho de escrita for esquecido no futuro, o INSERT/UPDATE falha em vez de gravar fantasma silencioso. Depende de estar dentro da janela e limite diário de migrations. Menciono como recomendação, não parte obrigatória do plano.

---

Não vou aplicar nada até você aprovar (ou pedir ajuste em) esta Parte 2. Confirmo se erra alguma classificação antes de tocar arquivo.
