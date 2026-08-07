# PDN — diagnóstico e plano para virar espelho operacional do pipeline

## 1. Como o PDN é montado hoje (lido no código, não suposto)

Rota `/pdn` → `src/pages/PdnGestor.tsx` (1.227 linhas) → `usePdn(mes)` (848 linhas) + `usePdnLive` (realtime) + `usePdnDivergencias` + `pdnSyncEngine.ts`.

**Uma linha do PDN nasce assim (`usePdn.allRows`):**
1. `loadDeals()` lê `pipeline_leads` com `stage_id` nos tipos `pos_visita | proposta | contrato_gerado | venda`, `arquivado = false`, no escopo do gestor (`resolve_managed_brokers`). Para cada lead busca `negocios` (VGV, empreendimento, data_assinatura, fase) e a 1ª entrada em etapa de venda em `pipeline_historico`.
2. Fallback: `negocios.fase='ganho'` com `data_assinatura` no mês, mesmo com lead arquivado — garante "PDN Ganho = Vendas Realizadas".
3. `loadEntries()` lê `pdn_entries` **apenas como overlay de notas** (observação, próxima ação, prioridade, risco, status livre, "corretor avisado"), recortado por `mes`.

**Ponto central: o refactor "PDN espelho" já aconteceu no frontend.** No `allRows` a etapa, VGV, empreendimento, corretor e equipe vêm sempre do pipeline/negócio; `caiu` é fixado em `false`; `oculto` e `grupo_override` não são mais lidos; linhas manuais (sem vínculo) não são mais exibidas.

**Escritas do PDN vão para o pipeline real** (`pdnSyncEngine.ts`): mover card → `syncPipelineStageFromPdn` (resolve `pipeline_stages`, atualiza `pipeline_leads.stage_id/stage_changed_at`, cria/atualiza `negocios`, grava `pipeline_historico`, notifica corretor); VGV/empreendimento → `syncNegocioVgvFromPdn` (`negocios.vgv_final/empreendimento`); queda → `discardLeadFromPdn` (lead para etapa Descarte + `negocios.status='perdido'`); inativar → `inactivateLeadFromPdn`.

**Sentido inverso já existe no banco:** dois triggers ativos escrevem em `pdn_entries` — `trg_pdn_mirror_pipeline_lead` (AFTER UPDATE OF stage_id/arquivado em `pipeline_leads` → grava `situacao` e `caiu`) e `trg_pdn_mirror_negocio` (AFTER UPDATE OF status em `negocios` → grava `caiu`/`motivo_queda`). Nenhuma trigger/edge function **cria** linha em `pdn_entries`; criação só acontece pelo frontend quando o gestor escreve uma nota.

## 2. Onde a sincronização falha de verdade

Conferi os números no banco hoje; alguns diferem do levantamento inicial:

| Fato | Verificado |
|---|---|
| Total `pdn_entries` | 160 |
| Sem `pipeline_lead_id` | 101 — mas **76 delas têm `negocio_id`** (o PDN resolve o lead pelo negócio). Órfãs de verdade (sem lead **e** sem negócio): **25**, todas de `mes = 2026-03` |
| Linhas linkadas apontando para lead morto | 26 (14 arquivado + 12 em Descarte) — confirmado |
| Texto `corretor` divergente do lead | **3 de 59** contra `profiles.nome`, não 58. A divergência de 98% provavelmente veio de comparar contra outra fonte de nome |
| Distribuição por mês | 2026-03: 25 · 2026-07: 127 · 2026-08 (mês corrente): **8** |
| `situacao` x etapa real do pipeline | 12 combinações; ex.: 18 `pos_visita` no PDN estão em `aquecimento`, 12 em `descarte`, 1 em `venda` |
| Estado paralelo em uso | `caiu=true` em 43, `oculto` em 20, `grupo_override` em 4 — **nenhum deles é lido pela UI hoje** |

**Diagnóstico real:** o PDN **não** é uma planilha paralela sendo lida — ele já lê do pipeline. O problema é que `pdn_entries` continua sendo uma tabela desnormalizada que:
- guarda cópias de `nome/empreendimento/corretor/equipe/vgv/situacao` que **envelhecem** e ainda são gravadas no INSERT do overlay (`usePdn.saveOverride` copia esses textos ao criar a linha de nota);
- é mantida por dois triggers que escrevem `situacao`/`caiu` que ninguém consome — custo e ruído puro, e é essa escrita que produz as combinações divergentes da tabela acima;
- carrega colunas mortas (`oculto`, `grupo_override`) e 25 linhas fantasma de março;
- mistura o overlay de meses distintos por índice de `negocio_id`/`pipeline_lead_id` (já recortado por `mes` no hook, mas o banco não impede duplicata).

**Respostas diretas:**
- **Mover card no PDN reflete no pipeline?** Sim — `pipeline_leads.stage_id` + histórico + notificação. Exceção: Ganho exige `data_assinatura` e é bloqueado no PDN (tem que ser feito em "Confirmar Ganho" no lead).
- **Mover no pipeline reflete no PDN?** Sim, porque o PDN lê o pipeline a cada refresh (`usePdnLive` em realtime). O trigger que escreve em `pdn_entries` é redundante.
- **Lead descartado/arquivado/ganho?** Descartado/arquivado: some do PDN (filtro `arquivado=false` + só 4 tipos de etapa). Ganho: aparece pelo `data_assinatura` do negócio, mesmo com lead arquivado. As 26 notas presas a leads mortos ficam órfãs invisíveis no banco.
- **De onde vêm as 101 sem lead?** 76 são notas criadas sobre linhas com `negocio_id` (o hook grava `pipeline_lead_id = null` quando há negócio) — isso é por design, não é bug. As 25 restantes são linhas manuais legadas de março, do modelo antigo de planilha.
- **Por que o corretor texto diverge?** Porque é cópia gravada no momento da nota e nunca atualizada. Hoje a UI já ignora esse campo — a divergência é dado morto, não erro exibido.

## 3. Arquitetura recomendada: **(A) derivação do pipeline**, com overlay mínimo

(B) — FKs + estado espelhado por trigger — reintroduz o problema que já custou esse retrabalho: dois donos da verdade e triggers de sincronização a manter. E o frontend já opera como (A).

Recomendo **(A) formalizada**: `pdn_entries` deixa de ser "linha do PDN" e vira **`pdn_notas`** conceitualmente — só anotação do gestor, chaveada por (`pipeline_lead_id`, `mes`), sem nenhuma cópia de dado de negócio. Tudo que é negócio vem de `pipeline_leads` + `negocios`. Uma view de leitura (`v_pdn_linhas`) consolida a montagem hoje feita em 5 queries no cliente.

### Passos (1 build cada)

**Passo 1 — Parar de gravar cópias e desligar o ruído (frontend + migration pequena)**
- `usePdn.saveOverride`: o INSERT deixa de copiar `nome/situacao/empreendimento/vgv/corretor/equipe`; grava só `gerente_id, pipeline_lead_id, negocio_id, mes` + a nota.
- Migration: `DROP TRIGGER trg_pdn_mirror_pipeline_lead` e `trg_pdn_mirror_negocio` (+ suas funções). Nada na UI lê o que elas escrevem.
- Risco: baixo. Validação: criar nota num lead de teste e conferir a linha em `pdn_entries` sem textos; mover o lead no pipeline e ver o PDN acompanhar.

**Passo 2 — Chave única e vínculo canônico (migration)**
- Backfill: para as 76 notas com `negocio_id` e sem lead, preencher `pipeline_lead_id` a partir de `negocios.pipeline_lead_id`.
- `UNIQUE (pipeline_lead_id, mes)` (parcial, onde `pipeline_lead_id IS NOT NULL`); FK `pipeline_lead_id → pipeline_leads(id) ON DELETE CASCADE` e `negocio_id → negocios(id) ON DELETE SET NULL`.
- Overlay passa a ser indexado só por (`pipeline_lead_id`, `mes`) no hook.
- Risco: médio (falha se houver duplicata) — o backfill roda com deduplicação por `updated_at` mais recente antes do índice.

**Passo 3 — Limpeza das linhas legadas (migration de dados)**
- 25 órfãs de março (sem lead e sem negócio): **arquivar**, não migrar — são do modelo de planilha manual, sem contraparte no pipeline. Marca `mes` histórico e move para `pdn_entries_legado` (cópia), depois deleta.
- 26 notas de lead morto: **manter** — a nota pertence ao lead, o lead é que saiu; com a FK+CASCADE elas somem naturalmente se o lead for excluído. Sem ação destrutiva.
- Colunas mortas `oculto`, `grupo_override`, `situacao`, `caiu`, `motivo_queda`, `nome`, `empreendimento`, `vgv`, `corretor`, `equipe`, `data_visita`: primeiro parar de escrever (Passo 1), depois `DROP COLUMN` só nesse passo, após uma semana de operação estável.
- Validação: exportar CSV das 25 antes; conferir contagem do PDN de julho/agosto antes e depois (deve ser idêntica, pois já não são exibidas).

**Passo 4 — Leitura consolidada em view (migration + hook)**
- `v_pdn_linhas`: lead + negócio + corretor/equipe (via `team_members`/`profiles`) + etapa mapeada para o grupo do PDN + venda do mês por `data_assinatura`, com `security_invoker` para respeitar RLS.
- `usePdn.loadDeals` passa de 5 round-trips para 1 select na view; regra de Ganho por `data_assinatura` fica no SQL (mesma SSOT do VGV, sem reimplementação).
- Risco: médio — é onde VGV/Ganho podem escorregar. Validação obrigatória: PDN Ganho do mês == Vendas Realizadas do mês, lado a lado, para 3 meses.

**Passo 5 — Operacional in loco (frontend)**
- Kanban com as 5 colunas do fim de funil e ação por card: mudar etapa, marcar queda com motivo canônico (`discardReasons`), publicar observação no lead, avisar corretor — tudo já existe, falta ficar acessível em 1 toque e funcionar em mobile.
- Quebrar `PdnGestor.tsx` (1.227 linhas) em planilha / lista mobile / células, conforme a regra de arquivos >500 linhas.

**Passo 6 — Reconciliação visível**
- Promover `PdnDivergencias` (negócio sem lead, lead sem negócio, fase divergente, lead arquivado com negócio ativo) a bloco fixo do topo, com ação de correção por linha.

## 4. O que NÃO pode quebrar

- **`negocios`**: nenhuma coluna alterada em nenhum passo; PDN só faz UPDATE de `vgv_final`/`empreendimento`/`fase`/`status` pelos caminhos já existentes.
- **VGV / comissão**: regra canônica é `fase='ganho' AND status='ativo' AND data_assinatura` no mês. A view do Passo 4 tem que reusar exatamente essa condição — nenhum cálculo novo de VGV no PDN, e nunca rateio no PDN.
- **Vendas Realizadas / relatórios**: `v_fato_venda` e `rpc_metricas` não são tocados. O critério de aceite de cada passo inclui "PDN Ganho do mês == Vendas Realizadas do mês".
- **Metas do gerente** (`ceo_metas_mensais`, `PdnMetaMes`): leem VGV do mesmo SSOT; não podem passar a ler da view do PDN.
- **Nada é apagado de `pipeline_leads`/`negocios`** em nenhum passo — as únicas deleções são as 25 linhas legadas de `pdn_entries`, com cópia prévia.

## Ordem sugerida
Passo 1 → validação no preview → Passo 2 → Passo 3 (fora do horário de pico, respeitando o limite de 2 migrations/dia) → Passo 4 → 5 → 6.
